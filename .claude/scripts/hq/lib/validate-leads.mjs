// validate-leads.mjs — the seven pipeline receipts plus `metric.observed` (ADR-0400, ADR-0408).
//
// One kind per pipeline fact, each with its own CLOSED payload validator — the shape
// validate-experiment.mjs established (ADR-0304): not one generic `lead.event` with a `type`
// discriminator, because that is where a missing branch passes silently.
//
// TWO rules here carry more weight than the rest, and both exist because THE REPO IS HEADED
// PUBLIC and git history is forever (ADR-0410):
//
//   1. No raw PII may enter a payload. Not a name, not an email, not a URL, and not a
//      free-text "summary" either — a summary leaks PII as easily as a field does. Every
//      person-derived id is the KEYED `lead_hmac_v<N>_` form, never a bare hash: emails are
//      low-entropy, so `sha256(email)` is dictionary-attackable by anyone holding a public
//      directory. That is why this module refuses evolve's `h-<hex16>` grammar for LEAD ids
//      while still accepting it for `metric.observed` source_ids (ADR-0408's dual grammar).
//
//   2. Idems are TOTAL-PREIMAGE over every identity-bearing field, absent optionals written
//      as a literal `-`. The C2 retro lesson: a partial preimage silently quarantined ~100
//      receipts as DUP_IDEM, and a cap derived from receipts that were never written counts
//      zero and never trips.

import { SpineError, sha256Hex } from "./canonical.mjs";

// NOT canonical.mjs's IST_TS_RE. That grammar permits an optional fractional part, so ONE
// instant has ten accepted spellings -- and these strings go into idem preimages verbatim,
// so two spellings of one moment become two receipts. A double-counted `outreach.replied`
// with triage_class "bounce" can FREEZE a healthy campaign; a double-counted meeting is a
// lie in the report. Payload timestamps therefore admit exactly one form, and the calendar
// is checked rather than only the shape.
const PAYLOAD_TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+05:30$/;

export const LEADS_KINDS = Object.freeze([
  "lead.researched",
  "outreach.sent",
  "outreach.replied",
  "meeting.booked",
  "lead.suppressed",
  "deal.won",
  "deal.lost",
  // ADR-0408: shipped HERE, in the first client's cycle, per ADR-0308 — evolve consumes the
  // feed and never bootstraps its own trigger. Shipping it in the same edit as the seven above
  // is deliberate: the closed vocabulary, the sync-golden and the install manifest each get
  // touched exactly once this cycle instead of twice.
  "metric.observed",
]);
const LEADS_KIND_SET = new Set(LEADS_KINDS);

export function isLeadsKind(kind) {
  return LEADS_KIND_SET.has(kind);
}

// ---------- grammars ----------

// The keyed id. `lead_hmac_v<N>_` + 32 lowercase hex (128 bits of an HMAC-SHA256 over the
// normalized email under a secret that never touches the repo or the spine).
//
// The version is a GENERAL \d+, not a literal 1. ADR-0400 rotates by adding a `_v2_` prefix,
// and store.mjs mints under the highest key in the keyring -- so pinning `v1` here would make
// every post-rotation id invalid on the day someone rotates, which is precisely the day the
// system must keep working. Phase 0 mints v1; the grammar does not care.
// CANONICAL version only: no leading zeros. `\d+` accepted `lead_hmac_v01_`, which the minter
// can never produce (store.mjs formats a Number) -- so a suppression receipt could be indexed
// under a string no lookup would ever equal, and the person gets contacted again. That is
// D1's un-fixed twin: D1 fixed the version RANGE and nobody fixed version CANONICALIZATION.
const LEAD_ID_RE = /^lead_hmac_v[1-9][0-9]*_[0-9a-f]{32}$/;
// Deliberately NOT accepted for a lead id, and asserted against by fixture: the unkeyed
// `h-<hex16>` form evolve uses for URL-derived source ids.
const BARE_HASH_RE = /^h-[0-9a-f]{16}$/;
// `|` is the idem preimage delimiter, so it must not be smuggleable into a campaign name.
const CAMPAIGN_RE = /^[a-z0-9-]{1,64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
// metric.observed source ids accept BOTH grammars (ADR-0408's flagged deviation back to
// PLAN-evolve): the frozen spec's opaque/`h-` forms, plus leads' keyed form.
const SOURCE_ID_RE = /^([A-Za-z0-9][A-Za-z0-9._-]{0,63}|h-[0-9a-f]{16}|lead_hmac_v[1-9][0-9]*_[0-9a-f]{32})$/;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// Provider message ids are EXTERNAL identifiers whose shape we do not control -- UUIDs,
// long opaque strings, vendor-prefixed hashes. TOKEN_RE's 64-char bound is a house rule for
// values we mint, and applying it to a value the provider mints would refuse a legitimate
// receipt for a send that already happened, which is the worst possible moment to be strict.
// Still bounded and still character-restricted, so it cannot smuggle a delimiter or PII.
const PROVIDER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;
// Metric dimensions are machine labels, never free text. The looser TOKEN_RE admitted
// "Priya.Sharma-Advocates" -- a person's name on a public spine, which safety property 1
// names explicitly and which assertNoPii (email/URL shapes only) cannot see.
const DIMENSION_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const STORE_ID_RE = /^[0-9a-f]{16}$/;
const FINGERPRINT_RE = /^[0-9a-f]{8}$/;
// ADR-0414. Same opaque-fixed-width discipline as drafts.mjs's `draft_<16 hex>` ref.
const REPLY_REF_RE = /^reply_[0-9a-f]{32}$/;

const PROVENANCE = new Set(["firm-site", "public-directory", "public-listing", "manual-linkedin-note"]);
const EMAIL_STATUS = new Set(["verified", "held"]);
const TRIAGE = new Set(["interested", "later", "no", "bounce", "unsubscribe"]);
const SUPPRESS_REASON = new Set(["bounce", "unsubscribe", "manual"]);
const GEO_RE = /^[A-Z]{2}$/;

// The PII tripwire of last resort, applied to EVERY string value in every leads payload.
// The wall is location isolation (ADR-0410); this is the alarm. It cannot prove arbitrary
// prose PII-free and is not claimed to — but an email or a URL reaching a payload is the
// common accident, and it dies here rather than on a public spine.
const EMAIL_SHAPE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_SHAPE = /\b(?:https?:\/\/|www\.)/i;
// A BARE HOST is the same leak as a URL with a scheme -- a firm domain is the deliverable
// form of a lead's identity. `www.sharma-associates.in` was refused while
// `sharma-associates.in` was ACCEPTED, decided by a cosmetic prefix. That is D2's un-fixed
// twin: pii-tripwire.sh carries the corrected reasoning (suffix matching over a domain, not
// an anchored alternation) and the lesson never reached this file.
//
// Anchored on a known-TLD suffix rather than "any dotted token", so machine values like
// `leads.campaign` or a semver stay legal while a real domain does not.
const BARE_HOST_SHAPE =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:com|net|org|in|co|io|app|dev|me|uk|us|info|biz)\b/i;

function assertNoPii(kind, key, value) {
  if (typeof value !== "string") return;
  if (EMAIL_SHAPE.test(value))
    throw new SpineError("BAD_LEADS_PII", `${kind} payload key "${key}" contains an email-shaped string — raw addresses never reach the spine (ADR-0410); use the keyed lead_hmac_v<N>_ id`);
  if (URL_SHAPE.test(value) || BARE_HOST_SHAPE.test(value))
    throw new SpineError("BAD_LEADS_PII", `${kind} payload key "${key}" contains a URL or a bare hostname — evidence links and firm domains live in the private store, never in a receipt (ADR-0410)`);
}

// Closed key sets. Missing required key, or ANY unknown key, is a refusal — never a
// normalization. Optionals are listed so that "absent" is a decision the schema made rather
// than a gap the validator happened not to notice.
const SHAPES = {
  "lead.researched": {
    required: ["lead_id", "campaign", "provenance", "geography", "email_status", "fact_count", "store_id", "store_fingerprint"],
    optional: ["below_bar"],
  },
  // `rehearsal` is REQUIRED, not optional, and that is the whole decision (ADR-0416).
  //
  // Optional means absent-equals-real. A bug that drops the mark would then silently
  // reclassify a rehearsal send as a real first touch — the exact fail-open this repo refuses,
  // in the one place ADR-0416 exists to prevent. The note above says optionals are listed so
  // that "absent" is a decision the schema made; absent must not be a decision here at all.
  // The cost is that every existing outreach.sent fixture has to carry it, and paying that
  // cost IS the point rather than a surprise inside it.
  "outreach.sent": {
    required: ["lead_id", "campaign", "touch_n", "idem_key", "provider_message_id", "submitted_at", "draft_sha", "rehearsal"],
    optional: [],
  },
  "outreach.replied": {
    required: ["lead_id", "campaign", "triage_class", "ingested_at", "reply_ref"],
    optional: ["in_reply_to_touch"],
  },
  "meeting.booked": { required: ["lead_id", "campaign", "booked_at"], optional: [] },
  "lead.suppressed": { required: ["lead_id", "reason", "suppressed_at"], optional: ["campaign"] },
  "deal.won": { required: ["lead_id", "campaign", "decided_at"], optional: ["amount_inr"] },
  "deal.lost": { required: ["lead_id", "campaign", "decided_at"], optional: ["amount_inr"] },
  "metric.observed": {
    required: ["module", "surface", "metric", "value", "unit_count", "window_start", "window_end", "source_id"],
    optional: ["variant", "cohort"],
  },
};

// ---------- idem preimages (ADR-0400 C3) ----------
//
// Absent optional = literal `-`, so a receipt WITH a variant and one WITHOUT can never
// collide, and neither can two that differ only in an optional.
const DASH = "-";
const opt = (v) => (v === undefined || v === null ? DASH : String(v));

export function leadsIdem(kind, p) {
  switch (kind) {
    // TOTAL preimage, and it now means it. The first version omitted draft_sha,
    // submitted_at, idem_key and provider_message_id from `outreach.sent` -- so re-approving
    // an EDITED draft for the same touch produced a colliding idem and the second receipt was
    // dropped as DUP_IDEM, while two mails had actually left the building. The daily cap and
    // the rolling touch cap then counted one. That is verbatim the C2 failure this rule cites
    // as its own reason for existing.
    case "lead.researched":
      return sha256Hex(`lead.researched|${p.campaign}|${p.lead_id}|${opt(p.below_bar)}|${p.store_fingerprint}`);
    // `rehearsal` is in the preimage, and adding the field WITHOUT extending it would have
    // been the more dangerous half of the change (ADR-0416). A field that lives in the payload
    // and not in the preimage means a rehearsal receipt and a real receipt that differ ONLY in
    // the mark collide on one idem — so the reconcile that exists to prevent a double-send
    // would be the thing that mixes the two classes it must never mix, and the second receipt
    // would vanish as DUP_IDEM exactly as ~100 did in C2. Both halves or neither.
    case "outreach.sent":
      return sha256Hex(`outreach.sent|${p.campaign}|${p.lead_id}|${p.touch_n}|${p.draft_sha}|${p.submitted_at}|${p.idem_key}|${p.provider_message_id}|${p.rehearsal}`);
    // ADR-0414. `ingested_at` is DELIBERATELY absent and its absence is the fix. It stamps our
    // processing, not the reply, so it split one reply into two receipts on any re-ingest --
    // which is the ordinary response to "did that run finish?" -- while `triage_class` being
    // absent collapsed a "no thanks" and an "unsubscribe me" arriving in the same second into
    // one receipt, dropping whichever came second. Total preimage means total over the fields
    // that distinguish two legitimately DIFFERENT receipts; two ingests of one reply are not
    // two receipts.
    case "outreach.replied":
      return sha256Hex(`outreach.replied|${p.campaign}|${p.lead_id}|${p.triage_class}|${p.reply_ref}`);
    case "meeting.booked":
      return sha256Hex(`meeting.booked|${p.campaign}|${p.lead_id}|${p.booked_at}`);
    case "lead.suppressed":
      return sha256Hex(`lead.suppressed|${p.lead_id}|${p.reason}`);
    case "deal.won":
    case "deal.lost":
      return sha256Hex(`${kind}|${p.campaign}|${p.lead_id}`);
    case "metric.observed":
      return sha256Hex(
        `metric.observed|${p.module}|${p.surface}|${opt(p.variant)}|${opt(p.cohort)}|` +
          `${p.metric}|${p.window_start}|${p.window_end}|${p.source_id}`
      );
    default:
      throw new SpineError("UNKNOWN_KIND", `leadsIdem called with non-leads kind ${JSON.stringify(kind)}`);
  }
}

// EXPORTED since slice 04. `guard.mjs sendCounts` takes window bounds that are compared against
// these very payload stamps, and it took them raw — so `...Z` or a date-only bound answered the
// ADR-0416 mixing question with a silent zero. A second copy of PAYLOAD_TS_RE over there would
// have been the same D5 the allowlist parsers were collapsed for; one grammar, one validator.
export function assertTs(kind, key, value) {
  const m = typeof value === "string" ? PAYLOAD_TS_RE.exec(value) : null;
  if (!m)
    throw new SpineError("BAD_LEADS_TS", `${kind}.${key} ${JSON.stringify(value)} must be exactly YYYY-MM-DDTHH:MM:SS+05:30 — one spelling per instant, with no fractional part, because this string goes into an idem preimage verbatim`);
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59)
    throw new SpineError("BAD_LEADS_TS", `${kind}.${key} ${JSON.stringify(value)} is out of range`);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    throw new SpineError("BAD_LEADS_TS", `${kind}.${key} ${JSON.stringify(value)} is not a real calendar date`);
}

// The same grammar as a PREDICATE, for a fold that must decide whether a stamp may be compared
// rather than refuse the run over it.
//
// `sendCounts` validated its window bounds through `assertTs` and then tested the PAYLOAD stamps
// with an 11-character prefix (`^\d{4}-\d{2}-\d{2}T`) before comparing the two lexicographically.
// So a receipt stamped `2026-08-04T04:00:00Z` -- a real send at 09:30 IST -- passed the prefix
// test, then sorted after every `+05:30` stamp because `Z` > `+`, and was EXCLUDED from a
// 09:00-10:00 IST window: `real: 0` for a window holding one real cold send. A fractional part
// does the same. Two grammars judging one comparison is D5 wearing a prefix test as a disguise;
// there is one grammar and this is it. A stamp that is a date but not the pinned spelling is
// UNPLACEABLE -- reported on its own axis, counted in every window, never string-compared.
export function isPayloadTs(value) {
  try { assertTs("payload", "submitted_at", value); return true; }
  catch (e) {
    if (e instanceof SpineError && e.code === "BAD_LEADS_TS") return false;
    throw e;
  }
}

export function assertLeads(event) {
  const kind = event.kind;
  const p = event.payload;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const shape = SHAPES[kind];
  if (!shape) throw new SpineError("UNKNOWN_KIND", `assertLeads called with non-leads kind ${JSON.stringify(kind)}`);

  // payload null/undefined threw a raw TypeError, escaping the SpineError taxonomy every
  // caller switches on.
  if (p === null || typeof p !== "object" || Array.isArray(p))
    throw new SpineError("BAD_LEADS", `${kind} payload must be an object`);

  const allowed = new Set([...shape.required, ...shape.optional]);
  for (const k of Object.keys(p))
    if (!allowed.has(k))
      throw new SpineError("BAD_LEADS", `${kind} payload has unknown key "${k}" (closed to ${[...allowed].join("|")})`);
  for (const k of shape.required)
    if (!has(p, k)) throw new SpineError("BAD_LEADS", `${kind} payload is missing "${k}" (own property; the prototype chain does not count)`);

  // The blanket PII sweep runs BEFORE the per-field rules, so a leaked address is reported as
  // a leak rather than as whatever shape error it also happens to be.
  for (const [k, v] of Object.entries(p)) assertNoPii(kind, k, v);

  if (kind === "metric.observed") {
    for (const k of ["module", "surface", "metric"])
      if (typeof p[k] !== "string" || !DIMENSION_RE.test(p[k]))
        throw new SpineError("BAD_LEADS", `metric.observed.${k} must be a lowercase machine dimension [a-z0-9][a-z0-9_-]* — not free text, which is where a person's name hides`);
    for (const k of ["variant", "cohort"])
      if (has(p, k) && (typeof p[k] !== "string" || !DIMENSION_RE.test(p[k])))
        throw new SpineError("BAD_LEADS", `metric.observed.${k}, when present, must be a lowercase machine dimension`);
    if (typeof p.value !== "number" || !Number.isFinite(p.value))
      throw new SpineError("BAD_LEADS", "metric.observed.value must be a finite number");
    if (!Number.isSafeInteger(p.unit_count) || p.unit_count < 0)
      throw new SpineError("BAD_LEADS", "metric.observed.unit_count must be a non-negative integer");
    assertTs(kind, "window_start", p.window_start);
    assertTs(kind, "window_end", p.window_end);
    if (p.window_start >= p.window_end)
      throw new SpineError("BAD_LEADS", "metric.observed.window_start must precede window_end");
    if (typeof p.source_id !== "string" || !SOURCE_ID_RE.test(p.source_id))
      throw new SpineError("BAD_LEADS", "metric.observed.source_id must be an opaque token, h-<16 hex>, or lead_hmac_v<N>_<32 hex>");
    return;
  }

  // Every remaining kind is lead-scoped and therefore carries the keyed id.
  if (typeof p.lead_id !== "string" || !LEAD_ID_RE.test(p.lead_id)) {
    const hint = BARE_HASH_RE.test(String(p.lead_id))
      ? " — the unkeyed h-<hex16> form is dictionary-attackable on a public spine (ADR-0400); lead ids must be the KEYED lead_hmac_v<N>_ form"
      : "";
    throw new SpineError("BAD_LEADS", `${kind}.lead_id must match lead_hmac_v<N>_<32 hex>${hint}`);
  }
  if (has(p, "campaign") && (typeof p.campaign !== "string" || !CAMPAIGN_RE.test(p.campaign)))
    throw new SpineError("BAD_LEADS", `${kind}.campaign must be [a-z0-9-]{1,64} — "|" is the idem delimiter and must not be smuggleable into it`);

  switch (kind) {
    case "lead.researched":
      if (!PROVENANCE.has(p.provenance))
        throw new SpineError("BAD_LEADS", `provenance ${JSON.stringify(p.provenance)} is outside the closed allowlist ${[...PROVENANCE].join("|")} (exact case) — purchased and login-wall sources are rejected structurally, not discouraged (ADR-0409)`);
      if (typeof p.geography !== "string" || !GEO_RE.test(p.geography))
        throw new SpineError("BAD_LEADS", "geography must be an ISO-3166 alpha-2 code, uppercase");
      if (!EMAIL_STATUS.has(p.email_status))
        throw new SpineError("BAD_LEADS", `email_status ${JSON.stringify(p.email_status)} is outside verified|held (exact case)`);
      if (!Number.isSafeInteger(p.fact_count) || p.fact_count < 0)
        throw new SpineError("BAD_LEADS", "fact_count must be a non-negative integer");
      if (has(p, "below_bar") && typeof p.below_bar !== "boolean")
        throw new SpineError("BAD_LEADS", "below_bar, when present, must be a boolean");
      if (typeof p.store_id !== "string" || !STORE_ID_RE.test(p.store_id))
        throw new SpineError("BAD_LEADS", "store_id must be 16 lowercase hex");
      if (typeof p.store_fingerprint !== "string" || !FINGERPRINT_RE.test(p.store_fingerprint))
        throw new SpineError("BAD_LEADS", "store_fingerprint must be 8 lowercase hex");
      break;
    case "outreach.sent":
      if (!Number.isSafeInteger(p.touch_n) || p.touch_n < 1)
        throw new SpineError("BAD_LEADS", "touch_n must be a positive integer");
      if (typeof p.idem_key !== "string" || !TOKEN_RE.test(p.idem_key))
        throw new SpineError("BAD_LEADS", "idem_key must be an opaque token (the provider idempotency key)");
      if (typeof p.provider_message_id !== "string" || !PROVIDER_ID_RE.test(p.provider_message_id))
        throw new SpineError("BAD_LEADS", "provider_message_id must be an opaque provider identifier (<=255 chars, no delimiters)");
      if (typeof p.draft_sha !== "string" || !HEX64.test(p.draft_sha))
        throw new SpineError("BAD_LEADS", "draft_sha must be a lowercase sha256 hex — approval binds the exact content (ADR-0412)");
      // A BOOLEAN, not a truthy value. "false", 0 and "" are all things a caller might reach
      // for to mean "not a rehearsal", and each of them would land in the idem preimage as a
      // different string — two spellings of one fact, which is how two receipts get written
      // for one send. There is no third state a reader may interpret: a send is a rehearsal
      // send or it is a real one (ADR-0416).
      if (typeof p.rehearsal !== "boolean")
        throw new SpineError("BAD_LEADS", `rehearsal must be a boolean — ADR-0416 marks every send as a rehearsal send (true) or a real one (false), and it is REQUIRED rather than optional because absent-equals-real would silently reclassify a rehearsal as a real first touch`);
      assertTs(kind, "submitted_at", p.submitted_at);
      break;
    case "outreach.replied":
      if (!TRIAGE.has(p.triage_class))
        throw new SpineError("BAD_LEADS", `triage_class ${JSON.stringify(p.triage_class)} is outside ${[...TRIAGE].join("|")} (exact case)`);
      if (has(p, "in_reply_to_touch") && (!Number.isSafeInteger(p.in_reply_to_touch) || p.in_reply_to_touch < 1))
        throw new SpineError("BAD_LEADS", "in_reply_to_touch, when present, must be a positive integer");
      // Opaque and FIXED-WIDTH, exactly as draft_ref is (ADR-0412). It is the reply's identity
      // on a public spine, so the shape is pinned here rather than trusted from the producer.
      if (typeof p.reply_ref !== "string" || !REPLY_REF_RE.test(p.reply_ref))
        throw new SpineError("BAD_LEADS", "reply_ref must be reply_<32 lowercase hex> — the content hash of the reply's raw bytes (ADR-0414); the body itself never reaches the spine");
      assertTs(kind, "ingested_at", p.ingested_at);
      break;
    case "meeting.booked":
      assertTs(kind, "booked_at", p.booked_at);
      break;
    case "lead.suppressed":
      if (!SUPPRESS_REASON.has(p.reason))
        throw new SpineError("BAD_LEADS", `reason ${JSON.stringify(p.reason)} is outside ${[...SUPPRESS_REASON].join("|")} (exact case)`);
      assertTs(kind, "suppressed_at", p.suppressed_at);
      break;
    case "deal.won":
    case "deal.lost":
      if (has(p, "amount_inr") && (!Number.isSafeInteger(p.amount_inr) || p.amount_inr < 0))
        throw new SpineError("BAD_LEADS", "amount_inr, when present, must be a non-negative integer in paise");
      assertTs(kind, "decided_at", p.decided_at);
      break;
  }

  // Bind the idem to the payload LAST, so a malformed field reports its own error first.
  //
  // Why bind at all (the decision.recorded precedent): the emit path honours a caller-supplied
  // --idem, so without this an attacker could pre-claim the stable key of a real receipt with a
  // decoy payload. The real receipt then collides on DUP_IDEM and is silently lost — and a cap
  // derived from receipts counts one fewer send than actually happened.
  const expected = leadsIdem(kind, p);
  if (event.idem !== expected)
    throw new SpineError("BAD_LEADS", `${kind}.idem must be the total preimage over its identity-bearing fields (ADR-0400) — a partial preimage is how ~100 receipts were quarantined as DUP_IDEM in C2`);
}
