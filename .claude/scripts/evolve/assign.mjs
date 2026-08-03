// assign.mjs — deterministic arm and cohort assignment, the canonical seal, TTL, concurrency.
//
// "If replay cannot re-derive it, it does not count." Assignment is therefore a PURE FUNCTION of
// (experiment_id, unit_id) and the declared split — never of a random draw, a counter, a clock,
// or how many units have been seen so far.
//
// TWO RULES THIS FILE LEARNED THE HARD WAY, both from a fresh-agent pass:
//
//  1. NO IN-BAND SEPARATORS. The first version hashed `${experimentId}|${unitId}` and
//     `${experimentId}|${unitId}|cohort`. A unit id of `u7|cohort` therefore produced the SAME
//     preimage as the cohort draw for `u7` — so for that unit the arm and the cohort were one
//     draw, 100% correlated, which is exactly what the separate preimage was there to prevent.
//     Hashing goes through canon.mjs, which is injective and domain-separated.
//
//  2. A REFUSAL MUST NOT SHARE A CHANNEL WITH AN ANSWER. `ttlExpired` returned `null` when it
//     could not evaluate its input, and `null` is falsy — so `if (ttlExpired(...)) kill()` read
//     "could not evaluate" as "not expired" and the experiment never died. Every predicate here
//     now either answers or throws; none of them returns a falsy "don't know".

import { digest, digestBits52 } from "./canon.mjs";

const BUCKETS = 100;

// A hash reduced mod 100 is biased toward the low buckets by (2^bits mod 100)/2^bits; at 52 bits
// that is ~2.1e-14. Rejection sampling would be exact and is not used, because a variable number
// of hash rounds is one more thing a replay has to reproduce.
const bucket = (domain, parts) => digestBits52(domain, parts) % BUCKETS;

const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

function assertUnit(experimentId, unitId) {
  // An object unit id used to stringify to "[object Object]", so EVERY object-valued unit in a
  // run landed in one arm and one cohort. `1` and `"1"` collided too.
  if (!isNonEmptyString(experimentId)) throw new TypeError("assign: experiment_id must be a non-empty string");
  if (!isNonEmptyString(unitId)) throw new TypeError("assign: unit_id must be a non-empty string");
}

function assertArmsAndSplit(arms, split) {
  if (!Array.isArray(arms) || arms.length < 2) throw new TypeError("assign: at least two arms");
  if (!arms.every(isNonEmptyString)) throw new TypeError("assign: every arm must be a non-empty string");
  // Duplicate tags turned a two-arm experiment into a one-arm experiment that could never reach
  // floor on the second tag, and it was accepted silently at open time.
  if (new Set(arms).size !== arms.length) throw new TypeError("assign: arm tags must be unique");
  if (!Array.isArray(split) || split.length !== arms.length) throw new TypeError("assign: split must have one entry per arm");
  // PER-ENTRY, not just the sum. `[99.9, 0.1]` summed to 100 and gave the second arm ZERO units
  // over half a million draws, because the walk is over 100 integer buckets. `[0,100]`,
  // `[-50,150]` and `[150,-50]` all passed the sum check too, each opening a live experiment with
  // an arm that structurally could not be reached — indistinguishable at open time from 50/50.
  for (const s of split)
    if (!Number.isSafeInteger(s) || s < 1 || s > BUCKETS - 1)
      throw new RangeError(`assign: split entry ${JSON.stringify(s)} must be an integer in 1..${BUCKETS - 1} (a fractional or zero share silently starves an arm)`);
  const sum = split.reduce((a, b) => a + b, 0);
  if (sum !== BUCKETS) throw new RangeError(`assign: split sums to ${sum}, must be ${BUCKETS}`);
}

/**
 * Which arm a unit belongs to. The split is walked as a cumulative range over 100 buckets in the
 * arms' DECLARED order — reordering `arms` is a different experiment, and `experiment.opened`
 * records the order it was opened with.
 */
export function armFor(experimentId, unitId, arms, split) {
  assertUnit(experimentId, unitId);
  assertArmsAndSplit(arms, split);
  const b = bucket("evolve/arm/v1", [experimentId, unitId]);
  let acc = 0;
  for (let i = 0; i < arms.length; i++) {
    acc += split[i];
    if (b < acc) return arms[i];
  }
  /* c8 ignore next */
  throw new Error("assign: unreachable — split validated to sum to 100");
}

export const COHORTS = Object.freeze(["generation", "verdict"]);

/** Which cohort a unit belongs to (ADR-0310: 50:50). A SEPARATE hash domain from the arm. */
export function cohortFor(experimentId, unitId, generationPct = 50) {
  assertUnit(experimentId, unitId);
  if (!Number.isSafeInteger(generationPct) || generationPct < 1 || generationPct > BUCKETS - 1)
    throw new RangeError("assign: generation share must be an integer in 1..99");
  return bucket("evolve/cohort/v1", [experimentId, unitId]) < generationPct ? "generation" : "verdict";
}

export function assign(experimentId, unitId, arms, split, generationPct = 50) {
  return {
    experiment_id: experimentId,
    unit_id: unitId,
    arm: armFor(experimentId, unitId, arms, split),
    cohort: cohortFor(experimentId, unitId, generationPct),
  };
}

/**
 * The concurrency cap (ADR-0310: 2 per module). Returns null when opening is allowed, or the
 * refusal reason.
 */
export function concurrencyRefusal(openIds, cap = 2) {
  // FAIL CLOSED on a missing list. `new Set(undefined)` is an empty set, so a caller whose spine
  // query returned nothing BECAUSE IT FAILED was told "cap not reached, go ahead" — the one
  // answer a cap must never give by accident. A bare string was counted per character.
  if (!Array.isArray(openIds)) return "the open-experiment list is not an array — refusing rather than assuming none are open";
  if (!openIds.every(isNonEmptyString)) return "the open-experiment list holds a non-string entry";
  if (!Number.isSafeInteger(cap) || cap < 1) return `concurrency cap ${JSON.stringify(cap)} is not a positive integer`;
  const uniq = [...new Set(openIds)].sort();
  return uniq.length >= cap
    ? `module already has ${uniq.length} open experiment(s) and the cap is ${cap}: ${uniq.join(", ")}`
    : null;
}

/**
 * The canonical seal check. Returns null when intact, or the refusal reason.
 *
 * A mismatch means the canonical file moved underneath a live experiment, so every measurement
 * taken since was taken against bytes that are no longer there. The answer is to KILL the
 * experiment: there is no honest way to attribute measurements either side of the change.
 */
export function sealBroken(recordedSha, currentSha) {
  const HEX64 = /^[0-9a-f]{64}$/;
  if (typeof recordedSha !== "string" || !HEX64.test(recordedSha)) return "recorded base_sha is not a sha256 digest";
  if (typeof currentSha !== "string" || !HEX64.test(currentSha)) return "current target digest is not a sha256 digest";
  return recordedSha === currentSha ? null : `canonical-drift: opened against ${recordedSha.slice(0, 12)}, target is now ${currentSha.slice(0, 12)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// An explicit offset is REQUIRED. ECMAScript parses an offset-less date-TIME as local and a bare
// date as UTC, so `2026-01-01T00:00:00` was killed on an IST machine and left running on a UTC
// one — a replay-determinism break in the module whose thesis is "if replay cannot re-derive it,
// it does not count".
const TS_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Whether an experiment has outlived its TTL. THROWS on anything it cannot evaluate — it never
 * returns a falsy "don't know", because the first version returned `null` there and every caller
 * read it as "not expired".
 *
 * TTL is mandatory (ADR-0310: 28 days). Expiry archives `no-verdict` WITH DATA: "we ran this and
 * it never reached floor" is itself a finding, and the next experiment on that surface needs it.
 */
export function ttlExpired(openedTs, ttlDays, now) {
  if (typeof openedTs !== "string" || !TS_WITH_OFFSET.test(openedTs))
    throw new TypeError(`ttlExpired: opened_ts ${JSON.stringify(openedTs)} must carry an explicit UTC offset — an offset-less timestamp expires on one machine and not another`);
  const t = Date.parse(openedTs);
  if (!Number.isFinite(t)) throw new TypeError(`ttlExpired: opened_ts ${JSON.stringify(openedTs)} is not a real instant`);
  if (!Number.isSafeInteger(ttlDays) || ttlDays < 1)
    throw new RangeError(`ttlExpired: ttl_days ${JSON.stringify(ttlDays)} must be a positive integer — TTL is mandatory`);
  if (!Number.isFinite(now)) throw new TypeError("ttlExpired: now must be epoch milliseconds");
  return now - t >= ttlDays * DAY_MS;
}

export { digest };
