// assign.mjs — deterministic arm and cohort assignment.
//
// "If replay cannot re-derive it, it does not count." Assignment is therefore a PURE FUNCTION of
// (experiment_id, unit_id) and the declared split — never of a random draw, a counter, a clock,
// or how many units have been seen so far. A replayed spine must place every unit exactly where
// the live run placed it, or every downstream count is a different experiment.
//
// Zero dependencies beyond node:crypto.

import { createHash } from "node:crypto";

// 52 bits, not 32. A hash reduced mod 100 is biased by (2^bits mod 100)/2^bits toward the low
// buckets; at 32 bits that is ~2.2e-8 per unit, at 52 bits it is ~2.1e-14. Neither is visible at
// experiment scale, but the wider draw costs nothing and the number is written down here rather
// than left for someone to rediscover. Rejection sampling would be exact; it is not used because
// a variable number of hash rounds is a variable that has to be replayed too.
const BUCKETS = 100;
function bucket(preimage) {
  const hex = createHash("sha256").update(preimage).digest("hex").slice(0, 13); // 13 hex = 52 bits
  return Number.parseInt(hex, 16) % BUCKETS;
}

/**
 * Which arm a unit belongs to.
 *
 * The split is walked as a CUMULATIVE range over 100 buckets in the arms' declared order, so the
 * mapping depends only on the declared order and the declared percentages. Reordering `arms`
 * changes the assignment — deliberately: that is a different experiment, and the `experiment.opened`
 * receipt records the order it was opened with.
 */
export function armFor(experimentId, unitId, arms, split) {
  if (!Array.isArray(arms) || arms.length < 2) throw new Error("armFor: at least two arms");
  if (!Array.isArray(split) || split.length !== arms.length) throw new Error("armFor: split must have one entry per arm");
  const sum = split.reduce((a, b) => a + b, 0);
  if (sum !== BUCKETS) throw new Error(`armFor: split sums to ${sum}, must be ${BUCKETS}`);
  const b = bucket(`${experimentId}|${unitId}`);
  let acc = 0;
  for (let i = 0; i < arms.length; i++) {
    acc += split[i];
    if (b < acc) return arms[i];
  }
  /* c8 ignore next */
  return arms[arms.length - 1]; // unreachable while split sums to 100
}

export const COHORTS = Object.freeze(["generation", "verdict"]);

/**
 * Which cohort a unit belongs to (ADR-0310: 50:50).
 *
 * A SEPARATE hash preimage from the arm, not a second read of the same one. Deriving both from
 * one draw correlates them: every unit in the low buckets would land in one arm AND one cohort
 * together, so the verdict cohort would systematically over-represent whichever arm the split
 * happens to put first.
 */
export function cohortFor(experimentId, unitId, generationPct = 50) {
  if (!Number.isSafeInteger(generationPct) || generationPct < 1 || generationPct > 99)
    throw new Error("cohortFor: generation share must be an integer in 1..99");
  return bucket(`${experimentId}|${unitId}|cohort`) < generationPct ? "generation" : "verdict";
}

/**
 * The full assignment for a unit. Returned together so a caller cannot accidentally derive one
 * from a different experiment than the other.
 */
export function assign(experimentId, unitId, arms, split, generationPct = 50) {
  return {
    experiment_id: experimentId,
    unit_id: unitId,
    arm: armFor(experimentId, unitId, arms, split),
    cohort: cohortFor(experimentId, unitId, generationPct),
  };
}

/**
 * The concurrency cap (ADR-0310: 2 per module).
 *
 * `openIds` is every experiment currently open for the module. The cap is checked against the
 * COUNT OF OPEN EXPERIMENTS, not against a counter someone increments: a counter drifts the
 * moment an experiment closes without the counter being told, and the spine already knows the
 * truth. Returns null when opening is allowed, or the refusal reason.
 */
export function concurrencyRefusal(openIds, cap = 2) {
  if (!Number.isSafeInteger(cap) || cap < 1) return `concurrency cap ${cap} is not a positive integer`;
  const n = new Set(openIds).size;
  return n >= cap
    ? `module already has ${n} open experiment(s) and the cap is ${cap}: ${[...new Set(openIds)].sort().join(", ")}`
    : null;
}

/**
 * The canonical seal check.
 *
 * `experiment.opened` records `base_sha`, the digest of the target file at open. The runner and
 * the verdict both re-compare it. A mismatch means the canonical file moved underneath a live
 * experiment, so every measurement taken since was taken against bytes that are no longer there.
 * The answer is to KILL the experiment, not to adjust it: there is no honest way to attribute
 * the measurements either side of the change.
 */
export function sealBroken(recordedSha, currentSha) {
  if (typeof recordedSha !== "string" || !/^[0-9a-f]{64}$/.test(recordedSha)) return "recorded base_sha is not a sha256 digest";
  if (typeof currentSha !== "string" || !/^[0-9a-f]{64}$/.test(currentSha)) return "current target digest is not a sha256 digest";
  return recordedSha === currentSha ? null : `canonical-drift: opened against ${recordedSha.slice(0, 12)}, target is now ${currentSha.slice(0, 12)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an experiment has outlived its TTL.
 *
 * TTL is mandatory (ADR-0310: 28 days). Expiry archives `no-verdict` WITH DATA — the receipts
 * are not discarded, because "we ran this and it never reached floor" is itself a finding, and
 * the next experiment on that surface needs to know the floor was unreachable.
 */
export function ttlExpired(openedTs, ttlDays, now) {
  const t = Date.parse(openedTs);
  if (!Number.isFinite(t)) return null;
  if (!Number.isSafeInteger(ttlDays) || ttlDays < 1) return null;
  return now - t >= ttlDays * DAY_MS;
}
