// Schema v1 validation -- the ONE validator core both modes share (ADR-0031).
//
// Every rule here is a closed rule: unknown kinds, unknown fields, and case-varied enum
// values are rejected, never normalized. Normalizing is how a validator quietly becomes a
// suggestion (council v2's case-insensitive-then-exact-compare class).

import { SpineError, ULID_RE, canonicalize, formatIst, nowMs, MAX_EVENT_BYTES } from "./canonical.mjs";

// How far ahead of the spine's own clock a ts may sit. Without a ceiling, one bad clock or
// one hostile payload creates 9999-12-31.jsonl -- a day file that can never be closed and
// that sorts after every real day forever.
const MAX_FUTURE_MS = Number(process.env.ARC_SPINE_MAX_FUTURE_MS || 2 * 24 * 60 * 60 * 1000);
// Token counts and rupee amounts are bounded because an unbounded one poisons every
// aggregate downstream: 1e308 + anything is still 1e308, and two of them are Infinity.
const MAX_COST_MAGNITUDE = 1e12;

// ADR-0026: the vocabulary is CLOSED at 18. Extensions only via a new ADR.
export const KINDS = Object.freeze([
  "idea.captured", "council.verdict", "approval.requested", "decision.recorded",
  "kickoff.done", "phase.closed", "review.completed", "qa.completed", "commit.done",
  "ship.done", "revenue.received", "revenue.simulated", "cost.incurred", "run.completed",
  "incident.raised", "redaction.applied", "day.closed", "note.logged",
]);
const KIND_SET = new Set(KINDS);

export const SCHEMA_VERSION = 1;

// Schema v1's exact key set (PLAN Appendix B). `sha` is the one key that may be absent on
// input -- the emitter computes it, and verifies it when supplied.
export const REQUIRED_KEYS = Object.freeze([
  "id", "v", "ts", "idem", "actor", "process", "model", "venture",
  "run_id", "kind", "payload", "outcome", "cost", "evidence", "supersedes",
]);
const ALLOWED_KEYS = new Set([...REQUIRED_KEYS, "sha"]);

const HEX64 = /^[0-9a-f]{64}$/;
const ACTOR_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
const PROCESS_RE = /^[a-z0-9][a-z0-9._-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;
const VENTURE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RUN_ID_RE = /^r-[A-Za-z0-9._-]{1,64}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9:._\/-]{0,127}$/;
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?\+05:30$/;
const OUTCOMES = new Set(["ok", "fail", "partial"]);
const COST_SOURCES = new Set(["measured", "estimated", "manual"]);
const COST_KEYS = ["tokens_in", "tokens_out", "inr_estimate", "source"];
// Money kinds carry amount + currency in their payload (REQ-03). amount is an integer in
// MINOR UNITS (paise): floats don't sum exactly, and the brief sums money.
const REVENUE_KINDS = new Set(["revenue.received", "revenue.simulated"]);
const CURRENCY_RE = /^[A-Z]{3}$/;
// decision.recorded (REQ-06) is a FIRST-PARTY event with a closed shape (assertDecision).
const VERDICTS = new Set(["approve", "reject"]);
const MAX_REASON_BYTES = 2000;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// True if s carries an ASCII control character (C0 range or DEL). Checked by code point so no
// control byte is ever written literally into this source file.
function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

function assertTimestamp(ts) {
  if (typeof ts !== "string") throw new SpineError("BAD_TS", "ts must be a string");
  const m = TS_RE.exec(ts);
  if (!m) throw new SpineError("BAD_TS", `ts "${ts}" is not RFC3339 with a +05:30 offset`);
  const [, y, mo, d, h, mi, s] = m.map(Number);
  if (mo < 1 || mo > 12) throw new SpineError("BAD_TS", `ts "${ts}": month ${mo}`);
  if (d < 1 || d > 31) throw new SpineError("BAD_TS", `ts "${ts}": day ${d}`);
  if (h > 23 || mi > 59 || s > 59) throw new SpineError("BAD_TS", `ts "${ts}": time out of range`);
  // Real-calendar check -- rejects 2026-02-30 and friends, which the ranges above allow.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    throw new SpineError("BAD_TS", `ts "${ts}" is not a real calendar date`);

  // Bound it against the spine's own clock. A far-future ts creates a day file that no
  // close will ever reach; a wildly backdated one rewrites the order of a day that later
  // days already assume is settled.
  const eventMs = Date.parse(ts);
  if (Number.isFinite(eventMs) && eventMs - nowMs() > MAX_FUTURE_MS)
    throw new SpineError("BAD_TS", `ts "${ts}" is further ahead than the spine accepts (now ${formatIst(nowMs())})`);
}

// Evidence paths are dereferenced by humans and tools later; a traversal or absolute path
// stored today is a file read somewhere else tomorrow.
function assertEvidencePath(p) {
  if (p === null) return;
  // Bytes, not UTF-16 units: a "512 char" limit counted in code units lets a path of
  // astral characters occupy four times the budget a reader allocated for it.
  if (typeof p !== "string" || p.length === 0 || Buffer.byteLength(p, "utf8") > 512)
    throw new SpineError("BAD_EVIDENCE", "evidence must be null or at most 512 bytes");
  if (hasControlChar(p)) throw new SpineError("BAD_EVIDENCE", "evidence contains a control character");
  if (p.includes("\\")) throw new SpineError("BAD_EVIDENCE", `evidence "${p}" contains a backslash -- POSIX-relative paths only`);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.startsWith("~"))
    throw new SpineError("BAD_EVIDENCE", `evidence "${p}" is absolute`);
  for (const seg of p.split("/"))
    if (seg === ".." || seg === ".")
      throw new SpineError("BAD_EVIDENCE", `evidence "${p}" contains a "${seg}" segment`);
}

function assertCost(cost) {
  if (cost === null) return;
  if (!isPlainObject(cost)) throw new SpineError("BAD_COST", "cost must be null or an object");
  for (const k of Object.keys(cost))
    if (!COST_KEYS.includes(k)) throw new SpineError("BAD_COST", `cost has unknown key "${k}"`);
  for (const k of COST_KEYS)
    if (!(k in cost)) throw new SpineError("BAD_COST", `cost is missing "${k}"`);
  for (const k of ["tokens_in", "tokens_out"]) {
    const v = cost[k];
    if (!Number.isSafeInteger(v) || v < 0) throw new SpineError("BAD_COST", `cost.${k} must be a non-negative integer`);
    if (v > MAX_COST_MAGNITUDE) throw new SpineError("BAD_COST", `cost.${k} of ${v} is beyond any real run`);
  }
  if (typeof cost.inr_estimate !== "number" || !Number.isFinite(cost.inr_estimate) || cost.inr_estimate < 0)
    throw new SpineError("BAD_COST", "cost.inr_estimate must be a non-negative finite number");
  if (cost.inr_estimate > MAX_COST_MAGNITUDE)
    throw new SpineError("BAD_COST", `cost.inr_estimate of ${cost.inr_estimate} is beyond any real run`);
  if (!COST_SOURCES.has(cost.source))
    throw new SpineError("BAD_COST", `cost.source "${cost.source}" is outside ${[...COST_SOURCES].join("|")}`);
}

// Money payloads (revenue.received / revenue.simulated) -- amount + currency (REQ-03).
// Everything else in the payload is free provider metadata; these two are the fields the brief
// will sum and label, so they are closed and exact.
function assertMoney(payload) {
  const { amount, currency } = payload;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_COST_MAGNITUDE)
    throw new SpineError("BAD_AMOUNT", `amount ${JSON.stringify(amount)} must be a positive integer in minor units (1..${MAX_COST_MAGNITUDE})`);
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency))
    throw new SpineError("BAD_CURRENCY", `currency ${JSON.stringify(currency)} must be an ISO-4217 alpha code (3 uppercase letters)`);
}

// decision.recorded (REQ-06) decides exactly one approval, with a case-exact verdict and a
// human reason. Unlike a provider money payload it carries no free metadata, so the shape is
// CLOSED: a malformed decision must never be sealed onto an append-only spine (REQ-02), and an
// un-normalized verdict keeps "Approve" or "reject " from ever counting as a real decision.
function assertDecision(event) {
  const payload = event.payload;
  for (const k of Object.keys(payload))
    if (k !== "decides" && k !== "verdict" && k !== "reason")
      throw new SpineError("BAD_DECISION", `decision.recorded payload has unknown key "${k}" (shape is closed to decides|verdict|reason)`);
  if (typeof payload.decides !== "string" || !ULID_RE.test(payload.decides))
    throw new SpineError("BAD_DECISION", "decision.decides must be the ULID of the approval.requested it decides");
  // A decision that decides its own id is a cycle no fold can resolve (mirrors supersedes-self).
  if (payload.decides === event.id)
    throw new SpineError("BAD_DECISION", "a decision cannot decide itself");
  if (typeof payload.verdict !== "string" || !VERDICTS.has(payload.verdict))
    throw new SpineError("BAD_VERDICT", `decision.verdict ${JSON.stringify(payload.verdict)} is outside approve|reject (exact case)`);
  if (typeof payload.reason !== "string" || payload.reason.length === 0)
    throw new SpineError("BAD_REASON", "decision.reason must be a non-empty string");
  const reasonBytes = Buffer.byteLength(payload.reason, "utf8");
  if (reasonBytes > MAX_REASON_BYTES)
    throw new SpineError("BAD_REASON", `decision.reason is ${reasonBytes} bytes, ceiling is ${MAX_REASON_BYTES}`);
  // A control character in the reason would smuggle terminal escapes into anything that later
  // prints the brief, and makes the receipt unreadable.
  if (hasControlChar(payload.reason))
    throw new SpineError("BAD_REASON", "decision.reason contains a control character");
}

// Throws SpineError on the first violation. The caller decides what a violation MEANS
// (exit 2 vs quarantine) -- this function never knows which mode it is running in.
export function validateEvent(event) {
  if (!isPlainObject(event)) throw new SpineError("BAD_JSON", "an event must be a JSON object");

  for (const k of Object.keys(event))
    if (!ALLOWED_KEYS.has(k)) throw new SpineError("UNKNOWN_FIELD", `unknown top-level field "${k}" (schema v1 is closed)`);
  for (const k of REQUIRED_KEYS)
    if (!(k in event)) throw new SpineError("MISSING_FIELD", `required field "${k}" is absent`);

  // Size first: it bounds every scan that follows.
  const canonicalNoSha = canonicalize((({ sha, ...rest }) => rest)(event));
  const bytes = Buffer.byteLength(canonicalNoSha, "utf8");
  if (bytes > MAX_EVENT_BYTES)
    throw new SpineError("OVERSIZE", `canonical event is ${bytes} bytes, ceiling is ${MAX_EVENT_BYTES}`);

  if (typeof event.id !== "string" || !ULID_RE.test(event.id))
    throw new SpineError("BAD_ULID", `id "${event.id}" is not a ULID (Crockford base32 x26)`);
  if (event.v !== SCHEMA_VERSION)
    throw new SpineError("BAD_VERSION", `v is ${JSON.stringify(event.v)}, this spine speaks v${SCHEMA_VERSION}`);
  assertTimestamp(event.ts);
  if (typeof event.idem !== "string" || !HEX64.test(event.idem))
    throw new SpineError("BAD_IDEM", "idem must be lowercase sha256 hex");
  if (typeof event.actor !== "string" || !ACTOR_RE.test(event.actor))
    throw new SpineError("BAD_ACTOR", `actor ${JSON.stringify(event.actor)} is not a clean actor id`);
  if (typeof event.process !== "string" || !PROCESS_RE.test(event.process))
    throw new SpineError("BAD_PROCESS", `process ${JSON.stringify(event.process)} must be name@x.y.z`);
  if (event.model !== null && (typeof event.model !== "string" || !MODEL_RE.test(event.model)))
    throw new SpineError("BAD_MODEL", `model ${JSON.stringify(event.model)} is not a clean model id or null`);
  if (typeof event.venture !== "string" || !VENTURE_RE.test(event.venture))
    throw new SpineError("BAD_VENTURE", `venture ${JSON.stringify(event.venture)} is not a slug`);
  if (typeof event.run_id !== "string" || !RUN_ID_RE.test(event.run_id))
    throw new SpineError("BAD_RUN_ID", `run_id ${JSON.stringify(event.run_id)} must look like r-...`);
  if (typeof event.kind !== "string" || !KIND_SET.has(event.kind))
    throw new SpineError("UNKNOWN_KIND", `kind ${JSON.stringify(event.kind)} is outside the closed 18 (ADR-0026)`);
  if (!isPlainObject(event.payload))
    throw new SpineError("BAD_PAYLOAD", "payload must be an object (use {} for none)");
  if (REVENUE_KINDS.has(event.kind)) assertMoney(event.payload);
  if (event.kind === "decision.recorded") assertDecision(event);
  if (typeof event.outcome !== "string" || !OUTCOMES.has(event.outcome))
    throw new SpineError("BAD_OUTCOME", `outcome ${JSON.stringify(event.outcome)} is outside ok|fail|partial (exact case)`);
  assertCost(event.cost);
  assertEvidencePath(event.evidence);
  if (event.supersedes !== null && (typeof event.supersedes !== "string" || !ULID_RE.test(event.supersedes)))
    throw new SpineError("BAD_SUPERSEDES", "supersedes must be a ULID or null");
  // A correction that supersedes itself is a cycle: any replay resolving supersedes chains
  // would never terminate on it.
  if (event.supersedes !== null && event.supersedes === event.id)
    throw new SpineError("BAD_SUPERSEDES", "an event cannot supersede itself");
  if ("sha" in event && (typeof event.sha !== "string" || !HEX64.test(event.sha)))
    throw new SpineError("BAD_SHA", "sha must be lowercase sha256 hex");

  return canonicalNoSha;
}
