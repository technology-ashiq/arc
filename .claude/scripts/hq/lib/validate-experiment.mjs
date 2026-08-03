// validate-experiment.mjs — the eight experiment receipts (ADR-0304, registered by ADR-0309).
//
// One kind per lifecycle step, each with its own CLOSED payload validator. Not one generic
// `experiment.event` with a `type` discriminator: that is the shape where a missing branch
// passes silently (ADR-0304, option 2).
//
// Every rule is closed. Unknown payload keys, missing keys, case-varied enums and near-miss ids
// are rejected, never normalized. If the verdict reads a field, a validator asserts it — a
// free-form payload is a place for decision-critical data to hide from the validator.
//
// Idems are TOTAL-PREIMAGE over every identity-bearing field, with an absent optional written as
// a literal `-`, so two receipts differing in any identity-bearing field can never collide. The
// emitter derives the idem for these kinds and refuses a caller-supplied one (anti-preclaim),
// following the `decision.recorded` precedent in validate.mjs.
//
// `metric.observed` is deliberately NOT here. It is the client's kind (ADR-0308) and building it
// in this lane is a no-go.

import { SpineError, sha256Hex } from "./canonical.mjs";
import { checkTargetPath } from "../../core/evolve-manifest.mjs";

export const EXPERIMENT_KINDS = Object.freeze([
  "experiment.opened",
  "experiment.assigned",
  "experiment.measured",
  "experiment.verdict",
  "promotion.proposed",
  "experiment.promoted",
  "experiment.rolled_back",
  "experiment.closed",
]);
const EXPERIMENT_KIND_SET = new Set(EXPERIMENT_KINDS);
export const isExperimentKind = (k) => EXPERIMENT_KIND_SET.has(k);

// ---------- grammars ----------

// Mirrors RUN_ID_RE's shape in validate.mjs: a typed prefix plus an opaque tail. The prefix is
// what makes a mis-wired id (a proposal id handed to an experiment field) fail loudly.
const EXPERIMENT_ID_RE = /^x-[A-Za-z0-9._-]{1,64}$/;
const PROPOSAL_ID_RE = /^p-[A-Za-z0-9._-]{1,64}$/;
// An opaque external id: unit ids and measurement source ids. The charset excludes `:` `/` `@`
// `%` and every other URL/email metacharacter, so a raw URL or address cannot pass the grammar
// at all — that IS the refusal, not a separate check bolted on after it.
const OPAQUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// The hashed form for anything derived from a URL, an email, or user data (16 hex = the first
// 64 bits of a sha256, enough to be collision-free at experiment scale and short enough to read).
const HASHED_ID_RE = /^h-[0-9a-f]{16}$/;
const ARM_RE = /^\+[a-z0-9][a-z0-9-]{0,31}$/;
const METRIC_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MODULE_RE = /^[a-z][a-z-]*$/;
const HEX64 = /^[0-9a-f]{64}$/;
// A git object name: abbreviated (7) through full (40). Lower-case hex only — git prints lower
// case, and accepting both would make two spellings of one commit two different receipts.
const COMMIT_REF_RE = /^[0-9a-f]{7,40}$/;
// Measurement windows are whole days, the same unit the spine's day files use.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const COHORTS = new Set(["generation", "verdict"]);
const VERDICT_OUTCOMES = new Set(["verdict", "no-verdict"]);
const CLOSE_OUTCOMES = new Set(["winner", "no-verdict", "killed"]);
const PROMOTION_KINDS = new Set(["promote", "revert"]);

const MAX_REASON_BYTES = 2000;
// A count beyond this is not a real experiment, and an unbounded one poisons every aggregate
// downstream (the same reasoning as MAX_COST_MAGNITUDE in validate.mjs).
const MAX_COUNT = 1e12;
const MAX_TTL_DAYS = 365;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
  }
  return false;
}

// ---------- closed payload shape ----------

// Required keys per kind, in preimage order. `promotion.proposed`'s last two are conditional:
// present iff kind === "revert", absent otherwise — enforced explicitly, not by omission.
const PAYLOAD_KEYS = Object.freeze({
  "experiment.opened": ["experiment_id", "module", "surface", "target_path", "base_sha", "split", "ttl_days", "arms"],
  "experiment.assigned": ["experiment_id", "unit_id", "arm", "cohort"],
  "experiment.measured": ["experiment_id", "unit_id", "arm", "cohort", "metric", "value", "unit_count", "window_start", "window_end", "source_id"],
  "experiment.verdict": ["experiment_id", "outcome", "bound", "delta", "n_per_arm", "config_hash", "metric_hash"],
  "promotion.proposed": ["proposal_id", "experiment_id", "kind", "patch_sha", "base_sha", "candidate_sha"],
  "experiment.promoted": ["proposal_id", "commit_ref", "observed_candidate_sha"],
  "experiment.rolled_back": ["proposal_id", "commit_ref"],
  "experiment.closed": ["experiment_id", "outcome", "reason"],
});
const REVERT_ONLY_KEYS = Object.freeze(["applies_to", "restores"]);

// The identity-bearing subset, in a FIXED order. Deliberately not "all payload keys": a measured
// value and a verdict's bound are observations, not identity — two corrected readings of the same
// unit/window must collide so the correction rides `supersedes` instead of landing as a second
// independent fact.
const IDEM_FIELDS = Object.freeze({
  "experiment.opened": ["experiment_id", "module", "surface", "target_path", "base_sha"],
  "experiment.assigned": ["experiment_id", "unit_id", "arm", "cohort"],
  "experiment.measured": ["experiment_id", "unit_id", "arm", "cohort", "metric", "window_start", "window_end", "source_id"],
  "experiment.verdict": ["experiment_id", "outcome", "config_hash", "metric_hash"],
  "promotion.proposed": ["proposal_id", "experiment_id", "kind", "patch_sha", "base_sha", "candidate_sha", "applies_to", "restores"],
  "experiment.promoted": ["proposal_id", "commit_ref", "observed_candidate_sha"],
  "experiment.rolled_back": ["proposal_id", "commit_ref"],
  "experiment.closed": ["experiment_id", "outcome"],
});

/**
 * The total-preimage idem for an experiment receipt. Absent optionals are written as a literal
 * `-`, so a revert proposal and a promote proposal that agree on every other field still differ.
 * Exported because the emitter derives it and the validator re-derives it — one formula, one file.
 */
export function experimentIdem(kind, payload) {
  const fields = IDEM_FIELDS[kind];
  if (!fields) throw new SpineError("UNKNOWN_KIND", `no idem formula for kind ${JSON.stringify(kind)}`);
  const parts = fields.map((f) => {
    const v = payload?.[f];
    return v === undefined || v === null ? "-" : String(v);
  });
  return sha256Hex([kind, ...parts].join("|"));
}

// ---------- field assertions ----------

const bad = (code, msg) => { throw new SpineError(code, msg); };

function assertEnum(v, set, name) {
  if (typeof v !== "string" || !set.has(v))
    bad("BAD_EXPERIMENT", `${name} ${JSON.stringify(v)} is outside ${[...set].join("|")} (exact case)`);
}

function assertRe(v, re, name, hint) {
  if (typeof v !== "string" || !re.test(v))
    bad("BAD_EXPERIMENT", `${name} ${JSON.stringify(v)} ${hint}`);
}

// A unit id or a measurement source id. Either an opaque token or the `h-` hashed form; a raw
// URL, email or path fails the charset. `PII` is the error code so a redaction sweep can find
// every one of these in the quarantine without parsing prose.
function assertOpaqueId(v, name) {
  if (typeof v !== "string" || !(OPAQUE_ID_RE.test(v) || HASHED_ID_RE.test(v)))
    bad("BAD_SOURCE_ID", `${name} ${JSON.stringify(v)} must be [A-Za-z0-9][A-Za-z0-9._-]{0,63} or h-<16 hex> — a raw URL, path or address never reaches the spine`);
}

function assertSha(v, name) {
  if (typeof v !== "string" || !HEX64.test(v))
    bad("BAD_SHA", `${name} ${JSON.stringify(v)} must be a lowercase sha256 hex digest`);
}

function assertFiniteNumber(v, name) {
  if (typeof v !== "number" || !Number.isFinite(v))
    bad("BAD_EXPERIMENT", `${name} ${JSON.stringify(v)} must be a finite number`);
}

function assertCount(v, name) {
  if (!Number.isSafeInteger(v) || v < 0 || v > MAX_COUNT)
    bad("BAD_EXPERIMENT", `${name} ${JSON.stringify(v)} must be a non-negative integer no larger than ${MAX_COUNT}`);
}

function assertDay(v, name) {
  if (typeof v !== "string" || !DAY_RE.test(v)) bad("BAD_WINDOW", `${name} ${JSON.stringify(v)} must be YYYY-MM-DD`);
  const [y, mo, d] = v.split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    bad("BAD_WINDOW", `${name} ${JSON.stringify(v)} is not a real calendar date`);
}

function assertReason(v, name) {
  if (typeof v !== "string" || v.length === 0) bad("BAD_REASON", `${name} must be a non-empty string`);
  const bytes = Buffer.byteLength(v, "utf8");
  if (bytes > MAX_REASON_BYTES) bad("BAD_REASON", `${name} is ${bytes} bytes, ceiling is ${MAX_REASON_BYTES}`);
  if (hasControlChar(v)) bad("BAD_REASON", `${name} contains a control character`);
}

function assertRepoPath(v, name) {
  const out = [];
  if (!checkTargetPath(v, name, out)) bad("BAD_TARGET_PATH", out.join("; "));
}

// Splits are integer percentages summing to exactly 100: floats do not sum exactly, and a split
// that misses 100 silently drops or double-counts units at assignment time.
function assertSplit(split, arms) {
  if (!Array.isArray(split)) bad("BAD_EXPERIMENT", "split must be an array of integer percentages");
  if (split.length !== arms.length)
    bad("BAD_EXPERIMENT", `split has ${split.length} entries but arms has ${arms.length} — an arm without a share is an arm nothing is assigned to`);
  let sum = 0;
  for (const s of split) {
    if (!Number.isSafeInteger(s) || s < 1 || s > 99)
      bad("BAD_EXPERIMENT", `split entry ${JSON.stringify(s)} must be an integer percentage in 1..99`);
    sum += s;
  }
  if (sum !== 100) bad("BAD_EXPERIMENT", `split sums to ${sum}, must be exactly 100`);
}

function assertArms(arms) {
  if (!Array.isArray(arms)) bad("BAD_ARM", "arms must be an array");
  if (arms.length < 2) bad("BAD_ARM", `arms has ${arms.length} entry/entries — an experiment needs at least two`);
  const seen = new Set();
  for (const a of arms) {
    assertRe(a, ARM_RE, "arms entry", "must be +slug (lower case, digits, hyphen; 32 chars max)");
    if (seen.has(a)) bad("BAD_ARM", `arms lists ${JSON.stringify(a)} twice`);
    seen.add(a);
  }
  return seen;
}

// ---------- per-kind validators ----------

function openedPayload(p) {
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertRe(p.module, MODULE_RE, "module", "must be a product name (^[a-z][a-z-]*$)");
  assertRe(p.surface, SLUG_RE, "surface", "must be a slug");
  assertRepoPath(p.target_path, "target_path");
  assertSha(p.base_sha, "base_sha");
  const arms = assertArms(p.arms);
  assertSplit(p.split, [...arms]);
  if (!Number.isSafeInteger(p.ttl_days) || p.ttl_days < 1 || p.ttl_days > MAX_TTL_DAYS)
    bad("BAD_EXPERIMENT", `ttl_days ${JSON.stringify(p.ttl_days)} must be an integer in 1..${MAX_TTL_DAYS} — TTL is mandatory, an experiment with no expiry never archives`);
}

function assignedPayload(p) {
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertOpaqueId(p.unit_id, "unit_id");
  assertRe(p.arm, ARM_RE, "arm", "must be +slug");
  assertEnum(p.cohort, COHORTS, "cohort");
}

function measuredPayload(p) {
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertOpaqueId(p.unit_id, "unit_id");
  assertRe(p.arm, ARM_RE, "arm", "must be +slug");
  assertEnum(p.cohort, COHORTS, "cohort");
  assertRe(p.metric, METRIC_NAME_RE, "metric", "must be a metric name (^[a-z][a-z0-9_]{0,63}$)");
  assertFiniteNumber(p.value, "value");
  assertCount(p.unit_count, "unit_count");
  assertDay(p.window_start, "window_start");
  assertDay(p.window_end, "window_end");
  // A window that ends before it starts makes every downstream bucket ambiguous, and an
  // inverted window is exactly how a "MISSING" window gets counted twice.
  if (p.window_start > p.window_end)
    bad("BAD_WINDOW", `window_start ${p.window_start} is after window_end ${p.window_end}`);
  assertOpaqueId(p.source_id, "source_id");
}

function verdictPayload(p) {
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertEnum(p.outcome, VERDICT_OUTCOMES, "outcome");
  assertFiniteNumber(p.bound, "bound");
  assertFiniteNumber(p.delta, "delta");
  // n_per_arm is an OBJECT keyed by arm tag, not a scalar: a single number cannot express
  // "both arms reached the floor", which is the precondition a verdict exists at all.
  if (!isPlainObject(p.n_per_arm)) bad("BAD_EXPERIMENT", "n_per_arm must be an object keyed by arm tag");
  const armKeys = Object.keys(p.n_per_arm);
  if (armKeys.length < 2) bad("BAD_ARM", `n_per_arm has ${armKeys.length} arm(s) — a difference is computed between at least two`);
  for (const k of armKeys) {
    assertRe(k, ARM_RE, "n_per_arm key", "must be +slug");
    assertCount(p.n_per_arm[k], `n_per_arm.${k}`);
  }
  // Both hashes ride the receipt so replay re-derives the SAME decision: the config hash pins
  // alpha + effect_floor + floors + windows, the metric hash pins the measurement set.
  assertSha(p.config_hash, "config_hash");
  assertSha(p.metric_hash, "metric_hash");
}

function proposedPayload(p) {
  assertRe(p.proposal_id, PROPOSAL_ID_RE, "proposal_id", "must be p-<token>");
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertEnum(p.kind, PROMOTION_KINDS, "kind");
  assertSha(p.patch_sha, "patch_sha");
  assertSha(p.base_sha, "base_sha");
  assertSha(p.candidate_sha, "candidate_sha");
  // The seal is the whole point of the lineage chain: a proposal whose candidate equals its base
  // changes nothing, and is far more likely a diff that silently produced no change than a real
  // no-op someone meant to propose.
  if (p.candidate_sha === p.base_sha)
    bad("BAD_LINEAGE", "candidate_sha equals base_sha — the proposal changes nothing");
  if (p.kind === "revert") {
    for (const k of REVERT_ONLY_KEYS)
      if (!(k in p)) bad("BAD_LINEAGE", `a revert proposal must carry "${k}"`);
    assertSha(p.applies_to, "applies_to");
    assertSha(p.restores, "restores");
    if (p.applies_to === p.restores)
      bad("BAD_LINEAGE", "applies_to equals restores — the revert restores what is already there");
  } else {
    for (const k of REVERT_ONLY_KEYS)
      if (k in p) bad("BAD_LINEAGE", `a promote proposal must not carry "${k}" — it is revert-only`);
  }
}

function promotedPayload(p) {
  assertRe(p.proposal_id, PROPOSAL_ID_RE, "proposal_id", "must be p-<token>");
  assertRe(p.commit_ref, COMMIT_REF_RE, "commit_ref", "must be a lower-case git object name (7-40 hex)");
  // The mismatch REFUSAL itself lives in the runner (Phase 03): it compares this against the
  // proposal's candidate_sha, which the spine cannot see from a single event. What is enforced
  // here is that the observed SHA was recorded at all — a promotion receipt without one is a
  // promotion nobody checked.
  assertSha(p.observed_candidate_sha, "observed_candidate_sha");
}

function rolledBackPayload(p) {
  assertRe(p.proposal_id, PROPOSAL_ID_RE, "proposal_id", "must be p-<token>");
  assertRe(p.commit_ref, COMMIT_REF_RE, "commit_ref", "must be a lower-case git object name (7-40 hex)");
}

function closedPayload(p) {
  assertRe(p.experiment_id, EXPERIMENT_ID_RE, "experiment_id", "must be x-<token>");
  assertEnum(p.outcome, CLOSE_OUTCOMES, "outcome");
  assertReason(p.reason, "reason");
}

const VALIDATORS = Object.freeze({
  "experiment.opened": openedPayload,
  "experiment.assigned": assignedPayload,
  "experiment.measured": measuredPayload,
  "experiment.verdict": verdictPayload,
  "promotion.proposed": proposedPayload,
  "experiment.promoted": promotedPayload,
  "experiment.rolled_back": rolledBackPayload,
  "experiment.closed": closedPayload,
});

/**
 * Validate one experiment receipt. Called from validateEvent AFTER the envelope is known good,
 * so `event.kind` is already one of the eight and `event.payload` is already a plain object.
 * Throws SpineError on the first violation.
 */
export function assertExperiment(event) {
  const kind = event.kind;
  const p = event.payload;
  const required = PAYLOAD_KEYS[kind];
  if (!required) bad("UNKNOWN_KIND", `no payload validator for kind ${JSON.stringify(kind)}`);

  // Closed shape FIRST: an unknown key is rejected before any field is read, so a typo'd key
  // never sits silently beside a correctly-spelled one that happens to validate.
  const allowed = new Set(kind === "promotion.proposed" ? [...required, ...REVERT_ONLY_KEYS] : required);
  for (const k of Object.keys(p))
    if (!allowed.has(k)) bad("BAD_EXPERIMENT", `${kind} payload has unknown key "${k}" (the payload is closed to ${[...allowed].join("|")})`);
  for (const k of required)
    if (!(k in p)) bad("BAD_EXPERIMENT", `${kind} payload is missing "${k}"`);

  VALIDATORS[kind](p);

  // Idem LAST, so a malformed field reports its own error before the derived-key mismatch it
  // would also cause. Welding the mechanical key to the semantic payload is what stops a caller
  // pre-claiming the stable key of a receipt it does not own (the desync assertDecision closes).
  const expected = experimentIdem(kind, p);
  if (event.idem !== expected)
    bad("BAD_IDEM", `${kind} idem must be the total preimage over ${IDEM_FIELDS[kind].join("|")} — supplied ${event.idem}, derived ${expected}`);
}
