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
  // `Object.hasOwn` and a type check, not a bare lookup: `zFor("constructor")` used to return
  // Object itself, the stats then went NaN, and the operator was told "the bound was too small"
  // when the truth was "that alpha was never supported". `"0.05"` as a string was accepted too.
  if (typeof alpha !== "number" || !Object.hasOwn(Z_BY_ALPHA, alpha))
    throw new Error(`${TEST_ID}: alpha ${JSON.stringify(alpha)} has no pinned quantile (supported: ${Object.keys(Z_BY_ALPHA).join(", ")})`);
  return Z_BY_ALPHA[alpha];
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
  // A GATE MUST NEVER THROW. The first version threw on ten realistic input shapes — `units` as
  // a string, a float, NaN, Infinity, a bigint; `successes > units`; `counts` absent; a
  // non-iterable `guardrails`; an unpinned alpha; a null input. An exception is not a refusal:
  // it carries no outcome and no reasons, and a caller looping over experiments inside a
  // try/catch SKIPS the experiment rather than recording `no-verdict`. Everything below returns.
  try {
    return decideInner(input);
  } catch (e) {
    return { outcome: "no-verdict", reasons: [`the verdict gate could not evaluate this input: ${e?.message ?? e}`], stats: null, missing_windows: null };
  }
}

// A number that is genuinely a count. `NaN` and `Infinity` both PASSED the old `c.units < floor`
// check — every comparison against NaN is false — and only died later inside `wilson`, so the
// floor gate never rejected them at all.
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

function decideInner(input) {
  if (input === null || typeof input !== "object") throw new TypeError("input must be an object");
  const {
    arms, counts, floor, alpha = 0.05, effectFloor = 0, mde = 0,
    guardrails, cohortViolations = 0, missingWindows = 0, computedBefore = false,
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
    if (counts === null || typeof counts !== "object") {
      reasons.push("counts is not an object");
    } else if (!Object.hasOwn(counts, champion) || !Object.hasOwn(counts, challenger)) {
      // OWN properties only. A `!c1 || !c2` check reads through the PROTOTYPE CHAIN, so a
      // polluted `Object.prototype["+challenger-a"]` supplied a full set of counts for an arm
      // that was not in `counts` at all — and the gate declared a verdict on it.
      reasons.push(`counts are missing for ${!Object.hasOwn(counts, champion) ? champion : challenger}`);
    } else {
      // Read ONCE and validate the captured value. The old code read `c.units` for the floor
      // check and then `c1.units` again inside the math; with an accessor property (a Proxy, an
      // ORM row, a lazy view) the two reads returned different numbers, and a verdict was
      // declared on an arm holding ONE unit against a floor of 1000.
      const u1 = counts[champion]?.units, s1 = counts[champion]?.successes;
      const u2 = counts[challenger]?.units, s2 = counts[challenger]?.successes;
      for (const [tag, u, s] of [[champion, u1, s1], [challenger, u2, s2]]) {
        if (!isCount(u) || u < 1) reasons.push(`${tag} units ${JSON.stringify(u)} is not a positive integer count`);
        else if (!isCount(s)) reasons.push(`${tag} successes ${JSON.stringify(s)} is not a non-negative integer count`);
        else if (s > u) reasons.push(`${tag} reports ${s} successes out of ${u} units`);
        // BOTH arms. Not the mean, not the total: an arm below floor has not been measured
        // enough to be compared, and the other arm's abundance does not fix that.
        else if (u < floor) reasons.push(`${tag} is below floor (${u} < ${floor})`);
      }

      if (reasons.length === 0) {
        stats = newcombeWilsonDifference(s1, u1, s2, u2, alpha);
        if (!(stats.lower >= effectFloor)) reasons.push(`bound ${stats.lower} does not clear effect_floor ${effectFloor}`);
        if (!(stats.d >= mde)) reasons.push(`point delta ${stats.d} does not reach the MDE ${mde}`);
      }
    }
  }

  // Guardrails must be PRESENT, even if empty. Defaulting to `[]` made "I forgot to pass them"
  // indistinguishable from "this surface has none" — the unresolved-guardrail discipline could
  // be skipped by omission rather than by lying.
  if (!Array.isArray(guardrails)) {
    reasons.push("guardrails must be an array (an absent guardrail set is not an empty one)");
  } else {
    // A guardrail whose own window is MISSING is UNRESOLVED, never "no breach found". Absence of
    // evidence read as evidence of absence is the whole failure this engine is built to refuse.
    for (const g of guardrails) {
      if (g === null || typeof g !== "object") { reasons.push(`a guardrail entry is ${JSON.stringify(g)}`); continue; }
      if (g.status === "breached") reasons.push(`guardrail ${g.name} breached`);
      else if (g.status !== "ok") reasons.push(`guardrail ${g.name} is unresolved (${JSON.stringify(g.status)}) - not scored as "no breach found"`);
    }
  }

  // The SAME rule the guardrails get, which the first version applied to them and not to this.
  // `cohortViolations` of null / NaN / {} / "abc" / -1 all coerced to a false `> 0` comparison,
  // so a violation counter that FAILED TO COMPUTE read as clean and a verdict was issued.
  if (!isCount(cohortViolations)) reasons.push(`the cohort violation count is unresolved (${JSON.stringify(cohortViolations)}) - not scored as zero`);
  else if (cohortViolations > 0) reasons.push(`${cohortViolations} cohort violation(s)`);

  // MISSING windows GATE, they do not merely decorate the receipt. The first version copied the
  // count into the output and never consulted it, so a verdict could be declared over data the
  // board itself had already reported as incomplete.
  if (!isCount(missingWindows)) reasons.push(`the missing-window count is unresolved (${JSON.stringify(missingWindows)})`);
  else if (missingWindows > 0) reasons.push(`${missingWindows} window(s) are MISSING - a verdict is not computed over known-incomplete data`);

  return {
    outcome: reasons.length === 0 ? "verdict" : "no-verdict",
    reasons,
    stats,
    missing_windows: missingWindows,
  };
}

// ---------- the config hash ----------

import { digest } from "./canon.mjs";

/**
 * The hash a verdict carries so a replay re-derives the SAME decision.
 *
 * Every input that can change what a verdict MEANS is in the preimage — alpha and effect_floor
 * above all (ADR-0310), plus the test id, the floor, the MDE, the arm order, the split, and each
 * guardrail's FULL definition. Anything omitted is a knob that can be turned after the fact
 * without the verdict looking different, which is the same class of failure as a free-form
 * payload.
 *
 * Encoded through canon.mjs rather than joined by hand. The hand-joined version collided six
 * ways, and one pair was fatal: `floor: 1000` and `floor: "1000"` produced the SAME HASH and
 * OPPOSITE VERDICTS. Joining array members with `,` inside a `,`-delimited field also made
 * `arms: ["+a","+b"]` (two arms) hash identically to `arms: ["+a,+b"]` (one), and binding
 * guardrails by NAME ALONE let a latency budget move from 200 to 9999 with a byte-identical
 * hash.
 */
export function configHash(cfg) {
  const guardrails = [...(cfg.guardrails || [])]
    .map((g) => [g?.name ?? null, g?.threshold ?? null, g?.direction ?? null])
    .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  return digest("evolve/config/v1", [
    TEST_ID, cfg.alpha, cfg.effectFloor, cfg.floor, cfg.mde,
    cfg.arms ?? null, cfg.split ?? null, guardrails,
  ]);
}

/**
 * The hash of the MEASUREMENT SET a verdict was computed from. Two verdicts with the same config
 * hash but different metric hashes were computed from different data — which is what a reader
 * needs before comparing them.
 *
 * Binds the VALUES, not only which windows contributed. The first version hashed six identity
 * fields and omitted the numbers, so two runs over identical windows with completely different
 * outcomes produced the same hash — "same config, different metric hash implies different data"
 * had no coverage of the data at all. It also joined with `|`, so a unit id containing `|`
 * merged two fields.
 */
export function metricHash(contributions) {
  if (!Array.isArray(contributions)) throw new TypeError("metricHash: contributions must be an array");
  const rows = contributions
    .map((c) => [c?.arm ?? null, c?.unit_id ?? null, c?.metric ?? null, c?.window_start ?? null, c?.window_end ?? null, c?.unit_count ?? null, c?.successes ?? null])
    .map((r) => JSON.stringify(r))
    .sort();
  return digest("evolve/metric/v1", [rows]);
}
