// verdict.mjs — `newcombe-wilson-difference-v1`, the ONE test this engine is allowed to run.
//
// ADR-0306 pins the test; ADR-0311 pins the EXPRESSION TREE, because two independent derivations
// of this formula disagreed by up to 24 ULP writing it two algebraically identical ways, and
// neither was correctly rounded against 60-digit exact arithmetic. The rules below are contract,
// not style — each one changes the last bits if broken, and the committed reference vectors will
// not reproduce:
//
//   * `z` is the literal double below; `z²` is `z*z`, never a literal.
//   * The half-width uses `4*n*p*(1-p)`, NOT `4*x*(n-x)/n`.
//   * `p - l` and `u - p` are LITERAL SUBTRACTIONS. Even where `centre === p` makes them
//     algebraically equal to the half-width, substituting it changes the answer by 1 ULP.
//   * `l` and `u` are clamped into [0,1] AFTER the roots, so no negative probability and no
//     u > 1 reaches the difference step.
//   * `upper` is NOT clamped to [-1,1]. Newcombe's method does not guarantee containment;
//     truncating it would be changing the method.
//
// Reordering two multiplications in here is a reviewed change that re-records the vectors.

export const TEST_ID = "newcombe-wilson-difference-v1";

// The 95th percentile of the standard normal — a ONE-SIDED bound at alpha = 0.05 (ADR-0310).
// Only this alpha is supported: a table of quantiles would be a second thing to get wrong, and
// the alpha rides the config hash precisely so a change to it is visible in every verdict.
const Z_BY_ALPHA = Object.freeze({ 0.05: 1.6448536269514722 });

export function zFor(alpha) {
  const z = Z_BY_ALPHA[alpha];
  if (z === undefined)
    throw new Error(`${TEST_ID}: alpha ${alpha} has no pinned quantile (supported: ${Object.keys(Z_BY_ALPHA).join(", ")})`);
  return z;
}

/**
 * The Wilson score interval for x successes in n trials. Returns {p, l, u}.
 * Written in the pinned F-2np form; see the header.
 */
export function wilson(x, n, z) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${TEST_ID}: n must be a positive integer`);
  if (!Number.isSafeInteger(x) || x < 0 || x > n) throw new Error(`${TEST_ID}: x must be an integer in 0..n`);
  const p = x / n;
  const z2 = z * z;
  const den = 2 * (n + z2);
  const centre = (2 * n * p + z2) / den;
  const halfw = (z * Math.sqrt(z2 + 4 * n * p * (1 - p))) / den;
  // Clamp AFTER the roots. At x=0 the pinned form already yields exactly 0; the clamp is here
  // for the near-1 case, where the roots can land either side of 1 depending on rounding.
  const l = Math.min(1, Math.max(0, centre - halfw));
  const u = Math.min(1, Math.max(0, centre + halfw));
  return { p, l, u };
}

/**
 * Newcombe's method-10 interval for the difference d = p2 - p1, where arm 2 is the CHALLENGER
 * and arm 1 the CHAMPION. Returns {p1, p2, l1, u1, l2, u2, d, lower, upper}.
 */
export function newcombeWilsonDifference(x1, n1, x2, n2, alpha = 0.05) {
  const z = zFor(alpha);
  const a1 = wilson(x1, n1, z);
  const a2 = wilson(x2, n2, z);
  const d = a2.p - a1.p;
  // Literal subtractions. See the header: substituting the half-width here is valid algebra and
  // a different number.
  const loTerm = Math.sqrt((a1.p - a1.l) ** 2 + (a2.u - a2.p) ** 2);
  const hiTerm = Math.sqrt((a1.u - a1.p) ** 2 + (a2.p - a2.l) ** 2);
  return {
    p1: a1.p, p2: a2.p, l1: a1.l, u1: a1.u, l2: a2.l, u2: a2.u,
    d, lower: d - loTerm, upper: d + hiTerm,
  };
}

// ---------- the gate ----------

/**
 * Decide whether a verdict EXISTS. Returns {outcome, reasons[], stats|null}.
 *
 * The default is NO VERDICT. Every condition below must be satisfied for a verdict to exist, and
 * each failure is reported by name — a bare "no verdict" tells an operator nothing about which
 * wall they hit.
 *
 * @param {object} input
 *   arms            [championTag, challengerTag] in that order
 *   counts          {arm: {units, successes}} over COMPLETE windows only
 *   floor           per-arm floor
 *   alpha           0.05
 *   effectFloor     the bound must clear this (ADR-0310: 0, plain superiority)
 *   mde             minimum detectable effect; the point delta must reach it
 *   guardrails      [{name, status: "ok"|"breached"|"unresolved"}]
 *   cohortViolations integer
 *   missingWindows  integer, for the record
 *   computedBefore  true if a verdict was already computed for this experiment
 */
export function decide(input) {
  const {
    arms, counts, floor, alpha = 0.05, effectFloor = 0, mde = 0,
    guardrails = [], cohortViolations = 0, missingWindows = 0, computedBefore = false,
  } = input;
  const reasons = [];

  // Fixed-horizon, compute-once. Peeking at a running experiment and stopping when it looks good
  // inflates the false-positive rate far above alpha; refusing the SECOND compute is what makes
  // the first one mean what it says.
  if (computedBefore) reasons.push("a verdict was already computed for this experiment (fixed-horizon: compute once)");

  if (!Array.isArray(arms) || arms.length !== 2) reasons.push("a difference is computed between exactly two arms");
  if (!Number.isSafeInteger(floor) || floor < 1) reasons.push("no per-arm floor is declared");

  let stats = null;
  if (reasons.length === 0) {
    const [champion, challenger] = arms;
    const c1 = counts[champion], c2 = counts[challenger];
    if (!c1 || !c2) {
      reasons.push(`counts are missing for ${!c1 ? champion : challenger}`);
    } else {
      // BOTH arms. Not the mean, not the total: an arm below floor has not been measured enough
      // to be compared, and the other arm's abundance does not fix that.
      for (const [tag, c] of [[champion, c1], [challenger, c2]])
        if (c.units < floor) reasons.push(`${tag} is below floor (${c.units} < ${floor})`);

      if (reasons.length === 0) {
        stats = newcombeWilsonDifference(c1.successes, c1.units, c2.successes, c2.units, alpha);
        if (!(stats.lower >= effectFloor)) reasons.push(`bound ${stats.lower} does not clear effect_floor ${effectFloor}`);
        if (!(stats.d >= mde)) reasons.push(`point delta ${stats.d} does not reach the MDE ${mde}`);
      }
    }
  }

  // A guardrail whose own window is MISSING is UNRESOLVED, never "no breach found". Absence of
  // evidence read as evidence of absence is the whole failure this engine is built to refuse.
  for (const g of guardrails) {
    if (g.status === "breached") reasons.push(`guardrail ${g.name} breached`);
    else if (g.status !== "ok") reasons.push(`guardrail ${g.name} is unresolved (${g.status}) - not scored as "no breach found"`);
  }

  if (cohortViolations > 0) reasons.push(`${cohortViolations} cohort violation(s)`);

  return {
    outcome: reasons.length === 0 ? "verdict" : "no-verdict",
    reasons,
    stats,
    missing_windows: missingWindows,
  };
}

// ---------- the config hash ----------

import { createHash } from "node:crypto";

/**
 * The hash a verdict carries so a replay re-derives the SAME decision.
 *
 * Every input that can change what a verdict MEANS is in the preimage — alpha and effect_floor
 * above all (ADR-0310), plus the test id, the floor, the MDE, the arm order and the guardrail
 * names. Anything omitted here is a knob that can be turned after the fact without the verdict
 * looking different, which is the same class of failure as a free-form payload.
 */
export function configHash(cfg) {
  const canon = [
    `test_id=${TEST_ID}`,
    `alpha=${cfg.alpha}`,
    `effect_floor=${cfg.effectFloor}`,
    `per_arm_floor=${cfg.floor}`,
    `mde=${cfg.mde}`,
    `arms=${(cfg.arms || []).join(",")}`,
    `split=${(cfg.split || []).join(",")}`,
    `guardrails=${[...(cfg.guardrails || []).map((g) => g.name)].sort().join(",")}`,
  ].join("\n");
  return createHash("sha256").update(canon).digest("hex");
}

/**
 * The hash of the MEASUREMENT SET a verdict was computed from — every (arm, unit, window) that
 * contributed, sorted. Two verdicts with the same config hash but different metric hashes were
 * computed from different data, which is exactly what a reader needs to know before comparing
 * them.
 */
export function metricHash(contributions) {
  const rows = [...contributions].map((c) => `${c.arm}|${c.unit_id}|${c.metric}|${c.window_start}|${c.window_end}|${c.unit_count}`).sort();
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}
