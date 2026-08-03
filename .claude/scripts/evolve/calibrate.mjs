// calibrate.mjs — is the council's confidence worth anything?
//
// A council that says "High confidence" and is right 55% of the time is not a council with a
// good record; it is a council whose confidence label means nothing. Calibration is the only way
// to find that out, and it is computed HERE from receipts rather than from Markdown session
// files, because a Markdown file is a claim and a receipt is a fact (ADR-0307).
//
// TWO RULES, and they are the same rule the rest of this lane runs on:
//
//   1. `unresolved` IS NOT A MISS. A session nobody followed up on is not a session the council
//      got wrong. It is excluded from the score and REPORTED as excluded — scoring it as 0 would
//      manufacture a calibration number out of an absence, which is the "MISSING, never zero"
//      failure wearing a statistician's hat.
//   2. BELOW FLOOR IS `insufficient evidence`, NOT A NUMBER. Three scored sessions can produce a
//      Brier score to four decimal places, and it means nothing. The floor is what stops a
//      precise-looking number being mistaken for a reliable one.
//
// NO BACKFILL (ADR-0307). Only receipts emitted from wiring-time forward count. Backfilling the
// historical Markdown sessions would invent calibration from sessions that were never scored,
// and the honest reading today — zero scored outcomes — is exactly what the board should show.

// ADR-0009's buckets. These are the probabilities the council's words are claimed to mean, and
// calibration measures whether they do.
export const BUCKETS = Object.freeze({ High: 0.85, Medium: 0.65, Low: 0.5 });

// Below this many scored sessions, no calibration figure is reported at all.
export const DEFAULT_FLOOR = 20;

export const INSUFFICIENT = "insufficient evidence";

/**
 * Pair `council.verdict` receipts with their `council.outcome`, then score.
 *
 * @param {object[]} events   every event from the reader (any kinds; the rest are ignored)
 * @param {number}   floor    minimum scored sessions before a figure is reported
 * @returns {{scored, excluded, pending, buckets, brier, verdict}}
 */
export function calibrate(events, floor = DEFAULT_FLOOR) {
  if (!Array.isArray(events)) throw new TypeError("calibrate: events must be an array");
  if (!Number.isSafeInteger(floor) || floor < 1) throw new RangeError("calibrate: floor must be a positive integer");

  const verdicts = new Map();  // session_id -> {confidence, call}
  const outcomes = new Map();  // session_id -> outcome
  for (const e of events) {
    const p = e?.payload;
    if (!p || typeof p !== "object") continue;
    if (e.kind === "council.verdict" && Object.hasOwn(BUCKETS, p.confidence)) verdicts.set(p.session_id, { confidence: p.confidence, call: p.call });
    else if (e.kind === "council.outcome") outcomes.set(p.session_id, p.outcome);
  }

  const buckets = {};
  for (const b of Object.keys(BUCKETS)) buckets[b] = { prob: BUCKETS[b], n: 0, hits: 0 };

  let scored = 0, excluded = 0, pending = 0, brierSum = 0;
  for (const [sid, v] of verdicts) {
    if (!outcomes.has(sid)) { pending++; continue; }
    const o = outcomes.get(sid);
    // Excluded, not zero. Reported, not dropped.
    if (o === "unresolved") { excluded++; continue; }
    // A `proceed` call is "right" when the thing happened; a `hold` call is "right" when it did
    // not. Scoring both as "happened == hit" would mark every correct hold as a miss.
    const happened = o === "happened";
    const hit = v.call === "proceed" ? happened : !happened;
    buckets[v.confidence].n++;
    if (hit) buckets[v.confidence].hits++;
    brierSum += (BUCKETS[v.confidence] - (hit ? 1 : 0)) ** 2;
    scored++;
  }

  const enough = scored >= floor;
  return {
    scored, excluded, pending, floor,
    buckets: Object.fromEntries(Object.entries(buckets).map(([b, s]) => [b, {
      ...s,
      // A hit-rate over 0 sessions is not 0% — there is nothing to rate.
      hit_rate: s.n === 0 ? null : s.hits / s.n,
    }])),
    brier: enough ? brierSum / scored : null,
    verdict: enough ? "calibrated" : INSUFFICIENT,
  };
}

/** Render the council panel for the board. Deterministic: fixed order, no invented numbers. */
export function renderCalibration(c) {
  const lines = ["COUNCIL CALIBRATION"];
  lines.push(`  scored        ${c.scored} (floor ${c.floor})`);
  lines.push(`  excluded      ${c.excluded}  unresolved outcomes - excluded, NOT counted as misses`);
  lines.push(`  pending       ${c.pending}  verdicts with no outcome recorded yet`);
  if (c.verdict === INSUFFICIENT) {
    lines.push(`  calibration   ${INSUFFICIENT}: ${c.scored} scored session(s), floor is ${c.floor}`);
    lines.push(`  brier         ${INSUFFICIENT}`);
  } else {
    lines.push(`  brier         ${c.brier.toFixed(4)}  (lower is better)`);
  }
  lines.push("  bucket   prob   n   hits   hit-rate");
  for (const b of ["High", "Medium", "Low"]) {
    const s = c.buckets[b];
    const rate = s.hit_rate === null ? "MISSING" : `${(s.hit_rate * 100).toFixed(1)}%`;
    lines.push(`  ${b.padEnd(8)} ${String(s.prob).padEnd(6)} ${String(s.n).padEnd(3)} ${String(s.hits).padEnd(6)} ${rate}`);
  }
  return lines.join("\n");
}

/**
 * A juror-weight change is a PROPOSAL. ADR-0307 and the propose-only non-negotiable: the machine
 * never applies it, and this function has no way to — it returns a diff and an inbox item.
 */
export function proposeJurorWeights(current, calibration) {
  if (calibration.verdict !== "calibrated")
    return { proposal: null, reason: `${INSUFFICIENT}: ${calibration.scored} scored session(s), floor is ${calibration.floor} - no weight change is proposed on a calibration that does not exist` };
  const changes = [];
  for (const [b, s] of Object.entries(calibration.buckets)) {
    if (s.hit_rate === null) continue;
    // The proposal is that a bucket's PROBABILITY should move toward its observed hit-rate. It
    // is a suggestion with its evidence attached, not an adjustment.
    if (Math.abs(s.hit_rate - s.prob) >= 0.1)
      changes.push({ bucket: b, declared: s.prob, observed: s.hit_rate, n: s.n });
  }
  return {
    proposal: changes.length ? { kind: "juror-weight-change", changes } : null,
    applied: false,
    reason: changes.length ? "proposed to the inbox for a human decision - never applied" : "every bucket is within 0.1 of its declared probability",
  };
}
