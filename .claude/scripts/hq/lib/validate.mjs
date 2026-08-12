// Schema v1 validation -- the ONE validator core both modes share (ADR-0031).
//
// Every rule here is a closed rule: unknown kinds, unknown fields, and case-varied enum
// values are rejected, never normalized. Normalizing is how a validator quietly becomes a
// suggestion (council v2's case-insensitive-then-exact-compare class).

import { SpineError, ULID_RE, canonicalize, formatIst, nowMs, MAX_EVENT_BYTES, sha256Hex, IST_TS_RE } from "./canonical.mjs";
import { EXPERIMENT_KINDS, assertExperiment, isExperimentKind } from "./validate-experiment.mjs";
import { LEADS_KINDS, assertLeads, isLeadsKind } from "./validate-leads.mjs";
import { POLICY_KINDS, assertPolicy, isPolicyKind, isPromotionRequest, assertPromotionRequest } from "./validate-policy.mjs";
import { isAbJudgement, assertAbJudgement, isNearMissAbJudgement, assertNotNearMiss, isAdoptionProposal, assertAdoptionProposal } from "./validate-absorb.mjs";
import { isLedgerRevenueKind, assertLedgerRevenue } from "./validate-ledger.mjs";

// How far ahead of the spine's own clock a ts may sit. Without a ceiling, one bad clock or
// one hostile payload creates 9999-12-31.jsonl -- a day file that can never be closed and
// that sorts after every real day forever.
const MAX_FUTURE_MS = Number(process.env.ARC_SPINE_MAX_FUTURE_MS || 2 * 24 * 60 * 60 * 1000);
// Token counts and rupee amounts are bounded because an unbounded one poisons every
// aggregate downstream: 1e308 + anything is still 1e308, and two of them are Infinity.
const MAX_COST_MAGNITUDE = 1e12;

// ADR-0026: the vocabulary is CLOSED. Extensions only via a new ADR.
// Extended 18 -> 21 by ADR-0106 (develop lifecycle: started / slice proven / handoff ready),
// then 21 -> 22 by ADR-0107 (slice.stuck — where a build bleeds time, for /arc-retro to read),
// then 22 -> 30 by ADR-0309 (evolve's eight experiment receipts, frozen by ADR-0304),
// then 31 -> 39 by ADR-0400 (leads' seven pipeline receipts) together with ADR-0408,
// then 39 -> 40 by ADR-0073 (the Constitution becoming law).
//
// `metric.observed` used to be deliberately absent here, because ADR-0308 rules that it lands
// in the FIRST CLIENT's cycle rather than in evolve's. leads IS that first client (ADR-0408),
// so it arrives now -- in the SAME edit as the seven pipeline kinds, so the closed vocabulary
// is touched once this cycle rather than twice. Its 4-week trigger clock does NOT start here:
// it starts at the first real send, which is Phase 3 and BLOCKED (ADR-0413).
export const KINDS = Object.freeze([
  "idea.captured", "council.verdict", "approval.requested", "decision.recorded",
  "kickoff.done", "phase.closed", "review.completed", "qa.completed", "commit.done",
  "ship.done", "revenue.received", "revenue.simulated", "cost.incurred", "run.completed",
  "incident.raised", "redaction.applied", "day.closed", "note.logged",
  "develop.started", "slice.done", "handoff.ready", "slice.stuck",
  ...EXPERIMENT_KINDS,
  // 30 -> 31 by ADR-0310: the council's terminal outcome. `council.verdict` records the CALL and
  // already existed (0 emitted); this records what actually happened, which is a distinct later
  // fact and therefore its own kind per ADR-0304's one-kind-per-lifecycle-step rule.
  "council.outcome",
  ...LEADS_KINDS,
  // 40 -> 44 by ADR-0508 (POL-E). Four authority receipts: two for a level change, because a
  // human decision and a machine demotion are different truth sources, and two for money.
  ...POLICY_KINDS,
  // 39 -> 40 by ADR-0073. The Constitution's own adoption clause names this kind, so until it
  // existed the clause was un-executable: the event that makes arc's highest-precedence document
  // law would itself quarantine as UNKNOWN_KIND. It is a company organ (ADR-0053), so its shape
  // lives here inline beside decision.recorded and the council pair, not in a lane module.
  "constitution.adopted",
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
// Exported (engine Cycle 6, ADR-0200) so process-lint can assert a canonical process's
// `name@version` against the SAME regex the spine enforces, rather than against a copy.
// A copied regex is a regex that drifts (retro-log 2026-07-22).
//
// ADR-0303 extends it to `name@x.y.z(+slug)?` so an experiment arm is addressable without a
// second identifier scheme. The definition moved to core/variant-grammar.mjs — three products
// need it now (hq, engine, and core's `evolve` section validator), and core is the one product
// every other already requires. RE-EXPORTED here, not re-declared: process-lint imports it from
// this module, and an alias keeps that import working while there stays exactly one regex.
// A legacy `name@x.y.z` is unchanged by construction — the suffix group is optional.
export { PROCESS_RE } from "../../core/variant-grammar.mjs";
import { PROCESS_RE } from "../../core/variant-grammar.mjs";
const VENTURE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RUN_ID_RE = /^r-[A-Za-z0-9._-]{1,64}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9:._\/-]{0,127}$/;
// Moved to canonical.mjs as IST_TS_RE so leads' payload `*_at` validator shares ONE definition
// with the event `ts` rule (ADR-0400). Aliased, not re-declared: a copied regex drifts.
const TS_RE = IST_TS_RE;
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
    // C0 (< 0x20), DEL (0x7f), AND C1 (0x80-0x9f). The C1 range includes NEL (U+0085) and CSI
    // (U+009B, a single-char terminal-escape introducer): the adversarial pass sealed a reason
    // carrying one past a C0-only check, smuggling a terminal escape onto the append-only spine.
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
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

// The stored-path discipline, in ONE place. Every path this schema keeps is dereferenced by a
// human or a tool later, so a traversal or an absolute path accepted today is a file read
// somewhere else tomorrow. Shared by `evidence` and by ADR-0073's constitution `document`: a
// second copy of these four rules is a second place the next hole has to be fixed, and it is the
// twin that gets missed (retro-log: the same read-validation fix landed in one module and not its
// sibling, twice in two days).
function assertPathShape(p, code, label) {
  if (hasControlChar(p)) throw new SpineError(code, `${label} contains a control character`);
  if (p.includes("\\")) throw new SpineError(code, `${label} "${p}" contains a backslash -- POSIX-relative paths only`);
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.startsWith("~"))
    throw new SpineError(code, `${label} "${p}" is absolute`);
  for (const seg of p.split("/"))
    if (seg === ".." || seg === ".")
      throw new SpineError(code, `${label} "${p}" contains a "${seg}" segment`);
}

// Evidence paths are dereferenced by humans and tools later; a traversal or absolute path
// stored today is a file read somewhere else tomorrow.
function assertEvidencePath(p) {
  if (p === null) return;
  // Bytes, not UTF-16 units: a "512 char" limit counted in code units lets a path of
  // astral characters occupy four times the budget a reader allocated for it.
  if (typeof p !== "string" || p.length === 0 || Buffer.byteLength(p, "utf8") > 512)
    throw new SpineError("BAD_EVIDENCE", "evidence must be null or at most 512 bytes");
  assertPathShape(p, "BAD_EVIDENCE", "evidence");
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
  // Bind the idem to the approval this decision names (checked LAST, so a bad shape/verdict/
  // reason still reports its own error first). arc-inbox keys a decision's idem on its decides,
  // and the emit path honours a caller-supplied --idem -- so without this an attacker could seal
  // a decision whose decides is a DECOY but whose idem pre-claims the stable key of a REAL
  // approval A: A can then never be decided (the legit decision collides on DUP_IDEM) yet still
  // shows open. Welding the mechanical key to the semantic decides closes that two-key desync.
  if (event.idem !== sha256Hex(`decision.recorded|${payload.decides}`))
    throw new SpineError("BAD_DECISION", `decision.idem must be sha256("decision.recorded|"+decides) -- a decision's idem is bound to the approval it decides`);
}

// constitution.adopted (ADR-0073) -- the Constitution becoming law. The shape is closed for the
// same reason decision.recorded is: this is the company's highest-precedence fact, and a malformed
// one must never seal onto an append-only spine.
//
// `sha256` is the field carrying the weight. policy-lint will quote Constitution E2 VERBATIM and
// has to prove WHICH BYTES it quoted. A receipt that names a document without pinning its content
// names a file that can be edited afterward with nothing noticing -- which is how the strictest
// gate in the company ends up anchored to a poster (PLAN-policy pre-mortem row 3).
const CONSTITUTION_KEYS = ["document", "version", "sha256"];
// Dotted numeric, two or three components. Deliberately NOT full semver: a constitution version is
// a human label on adopted text, and prerelease/build metadata is not a thing law has.
const CONSTITUTION_VERSION_RE = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/;

function assertConstitution(event) {
  const p = event.payload;
  for (const k of Object.keys(p))
    if (!CONSTITUTION_KEYS.includes(k))
      throw new SpineError("BAD_CONSTITUTION", `constitution.adopted payload has unknown key "${k}" (shape is closed to ${CONSTITUTION_KEYS.join("|")})`);
  for (const k of CONSTITUTION_KEYS)
    if (!(k in p))
      throw new SpineError("BAD_CONSTITUTION", `constitution.adopted payload is missing "${k}"`);
  if (typeof p.document !== "string" || p.document.length === 0 || Buffer.byteLength(p.document, "utf8") > 512)
    throw new SpineError("BAD_CONSTITUTION", "constitution.document must be a non-empty repo-relative path of at most 512 bytes");
  assertPathShape(p.document, "BAD_CONSTITUTION", "constitution.document");
  if (typeof p.version !== "string" || !CONSTITUTION_VERSION_RE.test(p.version))
    throw new SpineError("BAD_CONSTITUTION", `constitution.version ${JSON.stringify(p.version)} must be dotted numeric, e.g. "1.0"`);
  if (typeof p.sha256 !== "string" || !HEX64.test(p.sha256))
    throw new SpineError("BAD_CONSTITUTION", "constitution.sha256 must be lowercase sha256 hex of the adopted bytes");
  // Welded LAST, so a bad shape/path/version still reports its own error first -- same ordering
  // rule as assertDecision. The idem binds the mechanical key to the semantic content: adopting
  // byte-identical text twice collides on DUP_IDEM instead of writing a second law saying the same
  // thing, while an amendment hashes differently, earns its own idem for free, and names its
  // predecessor through the event-level `supersedes` rather than a payload flag.
  if (event.idem !== sha256Hex(`constitution.adopted|${p.sha256}`))
    throw new SpineError("BAD_CONSTITUTION", `constitution.idem must be sha256("constitution.adopted|"+sha256) -- an adoption's idem is bound to the text it adopts`);
}

// The council measuring ITSELF (ADR-0307/0310). Two kinds, both closed:
//
//   council.verdict  -- the CALL, with the confidence bucket it was made at
//   council.outcome  -- what actually happened, recorded later
//
// Both payloads are closed for the reason ADR-0304 gives: calibration is computed from these
// fields, so if the Brier score reads it, a validator asserts it. `unresolved` is a first-class
// outcome and NOT a miss — a session nobody followed up on is not a session the council got
// wrong, and scoring it as 0 would manufacture a calibration number out of an absence.
const COUNCIL_CONFIDENCE = new Set(["High", "Medium", "Low"]);
const COUNCIL_CALLS = new Set(["proceed", "hold"]);
const COUNCIL_OUTCOMES = new Set(["happened", "did-not-happen", "unresolved"]);
const SESSION_ID_RE = /^c-[A-Za-z0-9._-]{1,64}$/;

function assertCouncil(event) {
  const p = event.payload;
  const allowed = event.kind === "council.verdict"
    ? ["session_id", "question_hash", "call", "confidence"]
    : ["session_id", "outcome", "observed_at", "source_id"];
  for (const k of Object.keys(p))
    if (!allowed.includes(k)) throw new SpineError("BAD_COUNCIL", `${event.kind} payload has unknown key "${k}" (closed to ${allowed.join("|")})`);
  for (const k of allowed)
    if (!(k in p)) throw new SpineError("BAD_COUNCIL", `${event.kind} payload is missing "${k}"`);
  if (typeof p.session_id !== "string" || !SESSION_ID_RE.test(p.session_id))
    throw new SpineError("BAD_COUNCIL", `session_id ${JSON.stringify(p.session_id)} must be c-<token>`);
  if (event.kind === "council.verdict") {
    if (typeof p.question_hash !== "string" || !HEX64.test(p.question_hash))
      throw new SpineError("BAD_COUNCIL", "question_hash must be a lowercase sha256 hex");
    if (!COUNCIL_CALLS.has(p.call)) throw new SpineError("BAD_COUNCIL", `call ${JSON.stringify(p.call)} is outside ${[...COUNCIL_CALLS].join("|")} (exact case)`);
    // Case-EXACT, matching ADR-0009's buckets. "high" is not "High": a normalised bucket is a
    // bucket whose probability was chosen by the normaliser rather than by the juror.
    if (!COUNCIL_CONFIDENCE.has(p.confidence)) throw new SpineError("BAD_COUNCIL", `confidence ${JSON.stringify(p.confidence)} is outside ${[...COUNCIL_CONFIDENCE].join("|")} (exact case)`);
  } else {
    if (!COUNCIL_OUTCOMES.has(p.outcome)) throw new SpineError("BAD_COUNCIL", `outcome ${JSON.stringify(p.outcome)} is outside ${[...COUNCIL_OUTCOMES].join("|")} (exact case)`);
    if (typeof p.observed_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.observed_at))
      throw new SpineError("BAD_COUNCIL", "observed_at must be YYYY-MM-DD");
    if (typeof p.source_id !== "string" || !/^([A-Za-z0-9][A-Za-z0-9._-]{0,63}|h-[0-9a-f]{16})$/.test(p.source_id))
      throw new SpineError("BAD_COUNCIL", "source_id must be an opaque token or the h-<16 hex> hashed form");
  }
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
    // The count is derived, never typed: a hand-written "18" went stale the moment ADR-0106
    // extended the set, and a gate that misreports its own size teaches the wrong rule.
    throw new SpineError("UNKNOWN_KIND", `kind ${JSON.stringify(event.kind)} is outside the closed ${KINDS.length} (ADR-0026, extended by ADR-0073/0106/0107/0309/0310/0400/0508)`);
  if (!isPlainObject(event.payload))
    throw new SpineError("BAD_PAYLOAD", "payload must be an object (use {} for none)");
  if (REVENUE_KINDS.has(event.kind)) assertMoney(event.payload);
  // ADR-1002 / LED-C. Deliberately AFTER assertMoney, which already establishes that `amount` is a
  // positive integer in minor units -- so this runs on a payload whose core money field is known
  // good and adds the closed schema, the namespaced-id grammar and the cross-field invariant.
  // There is no ledger ingest CLI: this placement is what makes the PII contract unskippable,
  // because every path onto the spine goes through validateEvent.
  if (isLedgerRevenueKind(event.kind)) assertLedgerRevenue(event);
  if (event.kind === "decision.recorded") assertDecision(event);
  if (event.kind === "constitution.adopted") assertConstitution(event);
  if (isExperimentKind(event.kind)) assertExperiment(event);
  if (event.kind === "council.verdict" || event.kind === "council.outcome") assertCouncil(event);
  if (isLeadsKind(event.kind)) assertLeads(event);
  if (isPolicyKind(event.kind)) assertPolicy(event);
  // A PROFILE, not a kind: approval.requested stays generic for every other gate in the repo,
  // and only a payload declaring subject: "policy.promotion" is held to the strict shape.
  if (isPromotionRequest(event)) assertPromotionRequest(event);
  // The same pattern for absorb's owner-judge receipt (ADR-0603 / ABS-D): only a payload declaring
  // subject: "absorb.ab-judgement" is held to its shape, so the closed vocabulary gains ZERO kinds.
  if (isAbJudgement(event)) assertAbJudgement(event);
  if (isAdoptionProposal(event)) assertAdoptionProposal(event);
  // A subject differing only by case or whitespace is REFUSED, never normalized and never exempt.
  if (isNearMissAbJudgement(event)) assertNotNearMiss(event);
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
