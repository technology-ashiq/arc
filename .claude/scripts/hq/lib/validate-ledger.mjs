// validate-ledger.mjs — the revenue payload contract v1 (ADR-1002 / LED-C, ADR-1012 / LED-M).
//
// This module is the ONE control in the ledger lane that no later phase can repair. The spine is
// append-only and its closed days are immutable; `redact.mjs` is secrets-only and has no PII layer.
// A customer email that reaches a `revenue.*` payload is on the record permanently, in a repo that
// also backs a legal product, under a regime that grants erasure rights. There is no "later".
//
// So the rule is NOT "detect PII and reject it". A detector is a denylist, and a denylist is a
// guess about what a tired human will paste at 1am. Two structural rules do the work instead:
//
//   1. THE PAYLOAD SCHEMA IS CLOSED. Every key not named below is refused, whatever it holds.
//      `assertLedgerRevenue` never asks whether a field is "called something PII-ish" -- it
//      refuses every field it was not told about. That is what "rejects PII-shaped fields" means
//      operationally, and it is total where a denylist is a sample.
//
//   2. IDENTIFIERS ARE DEFINED BY A POSITIVE GRAMMAR, not by what they must not be.
//      `provider_payment_id` and `customer_ref` must both be `<provider>:<token>` where
//      `<provider>` is the SAME provider the payload declares, and `<token>` must have the shape a
//      MACHINE issues rather than merely a shape a human could type. See TOKEN_RE below for what
//      that means and for the honest limit of it.
//
//      An earlier version of this comment asserted that a phone number and a personal name "cannot
//      be spelled in this grammar". They could. An adversarial pass put a mobile number, a dotted
//      name, a PAN and an Aadhaar number on the spine through the real ingest path, and the
//      sentence claiming otherwise is exactly why nobody looked. A grammar is only worth what it
//      refuses, never what its comment says it refuses.
//
// The keyed-vs-bare hash rule is inherited from validate-leads.mjs (ADR-0410) rather than
// re-derived: emails are low-entropy, so `sha256(email)` is dictionary-attackable by anyone with a
// public directory. A bare hex digest is therefore refused as a `customer_ref` even though it
// satisfies the token grammar -- the field is for a PROVIDER-ISSUED id, and a provider does not
// issue you the sha256 of your own customer's email.
//
// Money is integers. `assertMoney` in validate.mjs already requires `amount` to be a positive safe
// integer in minor units, so ADR-1012 is partly this spine's existing law rather than a ledger
// invention; what this module adds is the cross-field invariant that makes the four derived
// components consistent with it.

import { SpineError, sha256Hex } from "./canonical.mjs";

export const LEDGER_REVENUE_KINDS = Object.freeze(["revenue.received", "revenue.simulated"]);
const LEDGER_REVENUE_SET = new Set(LEDGER_REVENUE_KINDS);

export function isLedgerRevenueKind(kind) {
  return LEDGER_REVENUE_SET.has(kind);
}

// Closed vocabulary of the payload. Required first, then optional; the union is the whole schema.
const REQUIRED = Object.freeze(["amount", "currency", "venture", "provider", "provider_payment_id"]);
// `refund_of` names the charge this event refunds (ADR-1016 / LED-Q). A refund is its own positive
// fact rather than a negative amount, because `assertMoney` has required a positive integer since
// Cycle 2 and because superseding the charge would erase a true record to store a second one.
const OPTIONAL = Object.freeze(["gross", "fees", "tax", "net", "plan", "interval", "customer_ref", "fx", "refund_of"]);
const ALLOWED = new Set([...REQUIRED, ...OPTIONAL]);

// The four derived money components travel together or not at all. A payload carrying `gross` and
// `tax` but no `fees` cannot be checked against the invariant, and an unchecked money field is
// worse than an absent one: it renders with the authority of a validated number.
const COMPONENTS = Object.freeze(["gross", "fees", "tax", "net"]);

const PROVIDER_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// THE TOKEN GRAMMAR, AND WHY IT IS SHAPED LIKE A PROVIDER ID RATHER THAN LIKE A CHARACTER CLASS.
//
// The first version of this was `[A-Za-z0-9][A-Za-z0-9_.-]{3,63}` and the header above claimed it
// excluded phone numbers, personal names and emails. Two of those three claims were FALSE, and an
// adversarial pass put all of these on the spine through the real ingest path:
//
//   razorpay:9876543210              a mobile number is "bare digits" AND is [A-Za-z0-9]+
//   razorpay:ashiq.ahmed             a dotted name carries no whitespace
//   razorpay:ashiq.ahmed.1994-06-02  name plus date of birth
//   razorpay:ABCDE1234F              a PAN
//   razorpay:123456789012            an Aadhaar number
//
// A character class cannot decide whether an opaque string encodes a person. What it CAN do is
// require the shape a machine issues: providers mint ids as `<type>_<random>` -- `pay_QX7fK2mNbT1aZ9`,
// `cust_9nQ2rT7bV1xK`, `txn_9f2Kd8Lm3Qp7Ts` -- and a human pasting a phone number, a name, a PAN or
// an Aadhaar number produces none of that. So the token must carry a lowercase type prefix, an
// underscore, and a body of at least four characters CONTAINING A DIGIT.
//
// HONEST LIMIT, stated rather than implied: `ashiq_ahmed1994` satisfies this. The grammar makes a
// careless paste structurally impossible and a deliberate encoding merely inconvenient; the closed
// schema is what bounds the blast radius, and this is the second lock, not the only one.
const TOKEN_RE = /^[a-z][a-z0-9]{1,15}_[A-Za-z0-9]{4,48}$/;
const TOKEN_NEEDS_DIGIT = /[0-9]/;
// `plan` is a product tier the OPERATOR names, so it is a lowercase slug and nothing else. The
// permissive form accepted `ashiq.ahmed.9876543210` -- a free-ish text field on a closed schema is
// the hole the closed schema exists to prevent, reopened one field at a time.
const PLAN_RE = /^[a-z][a-z0-9-]{0,31}$/;
const RATE_RE = /^(0|[1-9]\d{0,8})\.\d{1,8}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Must START WITH A LETTER: the permissive form accepted a bare mobile number as an fx source.
const SOURCE_RE = /^[a-z][a-z0-9-]{0,63}$/;
// 32/40/64 lowercase or uppercase hex: md5, sha1, sha256. See the keyed-hash note above.
const BARE_DIGEST_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9A-F]{32}|[0-9A-F]{40}|[0-9A-F]{64})$/;
// REQ-02 names quarterly explicitly ("normalized to MRR (/12, /3)"), and an earlier draft of this
// set omitted it -- which would have refused a real quarterly plan at ingest, permanently, on an
// append-only log.
const INTERVALS = new Set(["monthly", "quarterly", "annual", "one_time"]);
const MAX_MINOR_UNITS = 1e12;

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

// A real calendar date, not merely the shape. 2026-02-31 matches DATE_RE and is not a day.
function assertCalendarDate(value, field) {
  const m = DATE_RE.exec(value);
  if (typeof value !== "string" || !m)
    throw new SpineError("BAD_LEDGER_FX", `${field} ${JSON.stringify(value)} must be YYYY-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    throw new SpineError("BAD_LEDGER_FX", `${field} ${JSON.stringify(value)} is not a real calendar date`);
}

// Integer minor units, and NEVER a float that happens to be integral: `1000.0` parses as a Number
// indistinguishable from `1000`, so this check cannot separate them and does not pretend to --
// what it refuses is every non-integer, every unsafe magnitude and every non-number. The string
// and exponent shapes are refused by typeof, which is where they actually differ.
function assertMinorUnits(value, field, { min = 0 } = {}) {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new SpineError("BAD_LEDGER_MONEY", `${field} ${JSON.stringify(value)} must be an integer count of minor units (ADR-1012)`);
  if (value < min)
    throw new SpineError("BAD_LEDGER_MONEY", `${field} ${JSON.stringify(value)} must be >= ${min}`);
  if (value > MAX_MINOR_UNITS)
    throw new SpineError("BAD_LEDGER_MONEY", `${field} ${JSON.stringify(value)} is beyond any real payment`);
}

// `<provider>:<token>`, where the provider half must EQUAL the payload's own `provider`. A
// namespaced id whose namespace disagrees with the event that carries it is either a paste from
// the wrong dashboard or a reconciliation key that will never match its rail -- both silent.
function assertNamespacedId(value, field, provider) {
  if (typeof value !== "string")
    throw new SpineError("BAD_LEDGER_ID", `${field} must be a string`);
  const colon = value.indexOf(":");
  if (colon < 0)
    throw new SpineError("BAD_LEDGER_ID", `${field} ${JSON.stringify(value)} must be namespaced as provider:token (ADR-1002)`);
  const ns = value.slice(0, colon);
  const token = value.slice(colon + 1);
  if (ns !== provider)
    throw new SpineError("BAD_LEDGER_ID", `${field} is namespaced ${JSON.stringify(ns)} but the payload declares provider ${JSON.stringify(provider)}`);
  if (!TOKEN_RE.test(token) || !TOKEN_NEEDS_DIGIT.test(token.slice(token.indexOf("_") + 1)))
    throw new SpineError(
      "BAD_LEDGER_ID",
      `${field} token ${JSON.stringify(token)} is not a provider-issued id. Required shape: a lowercase type prefix, an underscore, ` +
      "then 4-48 alphanumerics containing at least one digit -- like pay_QX7fK2mNbT1aZ9 or cust_9nQ2rT7bV1xK. " +
      "A phone number, a personal name, a PAN and an Aadhaar number all fail this shape, which is the point: " +
      "the spine is append-only and nothing written here can ever be erased.",
    );
}

export function assertLedgerRevenue(event) {
  const p = event.payload;

  // Closed schema, checked BEFORE anything else: an unknown key is refused whatever it contains,
  // so a `customer_email` never reaches a field-specific rule that might have been lenient.
  for (const k of Object.keys(p))
    if (!ALLOWED.has(k))
      throw new SpineError(
        "UNKNOWN_LEDGER_FIELD",
        `unknown payload field ${JSON.stringify(k)} -- the revenue payload schema is CLOSED (ADR-1002). ` +
        `Allowed: ${[...ALLOWED].sort().join(", ")}. Nothing customer-identifying belongs on this spine.`,
      );
  for (const k of REQUIRED)
    if (!(k in p)) throw new SpineError("MISSING_LEDGER_FIELD", `required payload field ${JSON.stringify(k)} is absent`);

  if (typeof p.provider !== "string" || !PROVIDER_RE.test(p.provider))
    throw new SpineError("BAD_LEDGER_PROVIDER", `provider ${JSON.stringify(p.provider)} must be a lowercase slug`);

  // The payload names a venture and so does the envelope. They must agree: revenue attributed to
  // the wrong venture is a wrong P&L that renders with full confidence, and a kill-distance meter
  // reads it.
  if (typeof p.venture !== "string" || p.venture !== event.venture)
    throw new SpineError(
      "BAD_LEDGER_VENTURE",
      `payload venture ${JSON.stringify(p.venture)} must equal the event venture ${JSON.stringify(event.venture)}`,
    );

  assertNamespacedId(p.provider_payment_id, "provider_payment_id", p.provider);
  if ("customer_ref" in p) {
    assertNamespacedId(p.customer_ref, "customer_ref", p.provider);
    // The BODY, after the type prefix -- `cust_5d41402abc4b2a76b9719d911017c592` satisfies the
    // provider-id shape while being exactly the thing this rule exists to refuse. Testing the whole
    // token would have let it through and made the digest fixture pass for the wrong reason.
    const token = p.customer_ref.slice(p.customer_ref.indexOf(":") + 1);
    const body = token.slice(token.indexOf("_") + 1);
    if (BARE_DIGEST_RE.test(body))
      throw new SpineError(
        "BAD_LEDGER_ID",
        "customer_ref token is a bare hex digest. Emails are low-entropy, so sha256(email) is " +
        "dictionary-attackable by anyone holding a public directory (ADR-0410, inherited from leads). " +
        "This field carries a PROVIDER-ISSUED id, and a provider does not issue you a digest of your own customer.",
      );
  }

  if ("refund_of" in p) {
    assertNamespacedId(p.refund_of, "refund_of", p.provider);
    // A refund of itself is a cycle any derivation walking refund links would never terminate on,
    // and it is trivially reachable by pasting one id into both fields.
    if (p.refund_of === p.provider_payment_id)
      throw new SpineError("BAD_LEDGER_ID", "refund_of must not equal provider_payment_id -- an event cannot refund itself");
  }

  // `amount` AND `currency` are re-checked here even though assertMoney already covers both: this
  // module is imported by tests directly, and a validator whose guarantee depends on a sibling
  // being called first is a guarantee about call order rather than about payloads. `currency` was
  // left out of that reasoning in the first cut, so called directly this function accepted
  // `currency: {email: "..."}` -- the principle was written down and applied to one of the two.
  assertMinorUnits(p.amount, "amount", { min: 1 });
  if (typeof p.currency !== "string" || !/^[A-Z]{3}$/.test(p.currency))
    throw new SpineError("BAD_LEDGER_CURRENCY", `currency ${JSON.stringify(p.currency)} must be an ISO-4217 alpha code (3 uppercase letters)`);

  const present = COMPONENTS.filter((k) => k in p);
  if (present.length > 0 && present.length !== COMPONENTS.length) {
    const missing = COMPONENTS.filter((k) => !(k in p));
    throw new SpineError(
      "BAD_LEDGER_MONEY",
      `gross/fees/tax/net travel together or not at all -- ${missing.join(", ")} absent while ${present.join(", ")} present. ` +
      "A half-specified split cannot be checked against the invariant, and an unchecked money field renders with the authority of a validated one.",
    );
  }
  if (present.length === COMPONENTS.length) {
    for (const k of COMPONENTS) assertMinorUnits(p[k], k);
    // gross = amount + tax, and net = gross - tax - fees. Stated as a rule, not left to be
    // reverse-engineered from one worked example (PLAN Appendix A).
    if (p.gross !== p.amount + p.tax)
      throw new SpineError("BAD_LEDGER_MONEY", `gross ${p.gross} must equal amount + tax (${p.amount} + ${p.tax} = ${p.amount + p.tax})`);
    if (p.net !== p.gross - p.tax - p.fees)
      throw new SpineError("BAD_LEDGER_MONEY", `net ${p.net} must equal gross - tax - fees (${p.gross} - ${p.tax} - ${p.fees} = ${p.gross - p.tax - p.fees})`);
  }

  if ("plan" in p && (typeof p.plan !== "string" || !PLAN_RE.test(p.plan)))
    throw new SpineError("BAD_LEDGER_PLAN", `plan ${JSON.stringify(p.plan)} must be an opaque token`);
  if ("interval" in p && !INTERVALS.has(p.interval))
    throw new SpineError("BAD_LEDGER_INTERVAL", `interval ${JSON.stringify(p.interval)} must be one of ${[...INTERVALS].join(" | ")}`);

  // FX is a receipt, not a lookup (ADR-1003). It is REQUIRED when the money is not INR and
  // FORBIDDEN when it is -- an INR row carrying a rate has a conversion nobody performed, and a
  // foreign row without one can only be converted at render, which is what breaks replay.
  const foreign = p.currency !== "INR";
  if (foreign && !("fx" in p))
    throw new SpineError("BAD_LEDGER_FX", `currency ${JSON.stringify(p.currency)} is not INR, so fx {rate, source, date} is required at ingest (ADR-1003)`);
  if (!foreign && "fx" in p)
    throw new SpineError("BAD_LEDGER_FX", "an INR payload must not carry fx -- there is no conversion to record");
  if ("fx" in p) {
    const fx = p.fx;
    if (!isPlainObject(fx)) throw new SpineError("BAD_LEDGER_FX", "fx must be an object");
    for (const k of Object.keys(fx))
      if (k !== "rate" && k !== "source" && k !== "date")
        throw new SpineError("BAD_LEDGER_FX", `unknown fx field ${JSON.stringify(k)} -- fx is {rate, source, date} and nothing else`);
    for (const k of ["rate", "source", "date"])
      if (!(k in fx)) throw new SpineError("BAD_LEDGER_FX", `fx.${k} is absent`);
    // A DECIMAL STRING, never a float: a rate read back as a Number cannot round-trip its own
    // decimal spelling, and this value is a receipt of what a provider actually said.
    if (typeof fx.rate !== "string" || !RATE_RE.test(fx.rate))
      throw new SpineError("BAD_LEDGER_FX", `fx.rate ${JSON.stringify(fx.rate)} must be a decimal STRING like "83.20" (ADR-1012) -- a float cannot carry its own spelling`);
    // A ZERO RATE IS NOT A RATE. `"0.0"` satisfies the grammar and silently annihilates the
    // payment: a $1,000 charge renders as 0.00 with no flag, because every downstream multiply is
    // exact and exactly zero. A rate is a receipt of what a provider said, and no provider says
    // zero. Refused here rather than flagged at render, since the render has no way to tell a zero
    // rate from a genuinely tiny one.
    if (/^0(\.0+)?$/.test(fx.rate))
      throw new SpineError("BAD_LEDGER_FX", `fx.rate ${JSON.stringify(fx.rate)} is zero -- a zero rate annihilates the payment silently, and no provider settles at zero`);
    if (typeof fx.source !== "string" || !SOURCE_RE.test(fx.source))
      throw new SpineError("BAD_LEDGER_FX", `fx.source ${JSON.stringify(fx.source)} must be a lowercase slug naming where the rate came from`);
    assertCalendarDate(fx.date, "fx.date");
  }
}

// Written as a codepoint scan rather than a regex character class: a class spelled with LITERAL
// control characters puts those bytes into THIS file, which is exactly how a raw NUL got into
// pnl.mjs and made the money core binary to git. A check for control characters must not contain
// one. C0 plus DEL; the callers here never legitimately carry either.
const hasControlChar = (s) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------------------------
// THE MONTH CLOSE (ADR-1004 / LED-E) -- the one event kind this lane spends.
//
// A close is the only thing in the ledger that is STORED rather than derived. Everything else is
// computed at render from the payments themselves (ADR-1000); "this month was reconciled against
// what the provider actually says it settled, and frozen" cannot be recomputed from the payments,
// because the provider's number is not on the spine anywhere else.
//
// THE SHAPE IS CLOSED, and the invariant below is the whole point of the receipt: a rail may only
// appear here with spine_minor === provider_minor. A close exists ONLY behind a green gate, so a
// `month.closed` carrying a mismatch would be a receipt of a reconciliation that failed -- a
// permanent, append-only record asserting a month was reconciled when it was not. Refused at the
// door rather than checked by whoever reads it later, because on an append-only log there is no
// later.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RAIL_KEYS = Object.freeze(["provider", "currency", "spine_minor", "provider_minor", "source", "input_sha"]);
const CLOSE_KEYS = Object.freeze(["month", "rails", "payment_count"]);
const RECONCILE_SOURCES = new Set(["file", "total"]);

export function assertMonthClosed(event) {
  const p = event.payload;
  if (!isPlainObject(p)) throw new SpineError("BAD_MONTH_CLOSE", "month.closed payload must be an object");
  for (const k of Object.keys(p))
    if (!CLOSE_KEYS.includes(k))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed has unknown key ${JSON.stringify(k)} (the shape is closed to ${CLOSE_KEYS.join("|")})`);
  for (const k of CLOSE_KEYS)
    if (!(k in p)) throw new SpineError("BAD_MONTH_CLOSE", `month.closed is missing ${JSON.stringify(k)}`);

  if (typeof p.month !== "string" || !MONTH_RE.test(p.month))
    throw new SpineError("BAD_MONTH_CLOSE", `month.closed.month ${JSON.stringify(p.month)} must be YYYY-MM`);
  if (!Number.isSafeInteger(p.payment_count) || p.payment_count < 0)
    throw new SpineError("BAD_MONTH_CLOSE", `month.closed.payment_count ${JSON.stringify(p.payment_count)} must be a non-negative integer`);

  // AT LEAST ONE RAIL. A close with an empty rails array reconciles nothing and would render
  // identically to a real one -- "no rail had input" and "every rail matched" must never look the
  // same, which is the same rule the gate enforces upstream, restated where it cannot be skipped.
  if (!Array.isArray(p.rails) || p.rails.length === 0)
    throw new SpineError("BAD_MONTH_CLOSE", "month.closed.rails must be a non-empty array -- a close reconciling zero rails is a close that checked nothing");

  const seen = new Set();
  for (const [i, r] of p.rails.entries()) {
    if (!isPlainObject(r)) throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}] must be an object`);
    for (const k of Object.keys(r))
      if (!RAIL_KEYS.includes(k))
        throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}] has unknown key ${JSON.stringify(k)} (closed to ${RAIL_KEYS.join("|")})`);
    for (const k of RAIL_KEYS)
      if (!(k in r)) throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}] is missing ${JSON.stringify(k)}`);
    if (typeof r.provider !== "string" || !PROVIDER_RE.test(r.provider))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}].provider ${JSON.stringify(r.provider)} must be a lowercase slug`);
    if (typeof r.currency !== "string" || !/^[A-Z]{3}$/.test(r.currency))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}].currency ${JSON.stringify(r.currency)} must be an ISO-4217 alpha code`);
    for (const k of ["spine_minor", "provider_minor"]) {
      const v = r[k];
      // ZERO IS LEGAL and negative is not: a rail that genuinely settled nothing in a month closes
      // at 0 on both sides, which is a real and reportable fact. A negative total is an upstream
      // arithmetic bug wearing a receipt.
      if (!Number.isSafeInteger(v) || v < 0 || v > MAX_MINOR_UNITS)
        throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}].${k} ${JSON.stringify(v)} must be a non-negative integer in minor units`);
    }
    if (r.spine_minor !== r.provider_minor)
      throw new SpineError("BAD_MONTH_CLOSE",
        `month.closed.rails[${i}] (${r.provider}/${r.currency}) has spine_minor ${r.spine_minor} against provider_minor ${r.provider_minor} -- a close is only ever written behind a GREEN gate, so a receipt carrying a mismatch is a permanent record asserting a reconciliation that did not happen`);
    if (!RECONCILE_SOURCES.has(r.source))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}].source ${JSON.stringify(r.source)} is outside ${[...RECONCILE_SOURCES].join("|")}`);
    if (typeof r.input_sha !== "string" || !HEX64_RE.test(r.input_sha))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails[${i}].input_sha must be a lowercase sha256 of the reconciliation input -- naming a number without pinning the bytes it came from is a receipt of nothing`);
    // ONE RAIL PER (provider, currency). Two rows for the same rail would let one matching row and
    // one mismatching row coexist, and every reader would have to guess which is the rail.
    const key = `${r.provider}|${r.currency}`;
    if (seen.has(key))
      throw new SpineError("BAD_MONTH_CLOSE", `month.closed.rails names ${key} twice -- a rail is one provider account settling into one currency, and it reconciles once`);
    seen.add(key);
  }

  // A MONTH CLOSES ONCE. The idem is welded to the month for the same reason the decision idem is
  // welded to its approval: the emit path honours a caller-supplied --idem, so without this a
  // second close of the same month could be sealed under a different key and both would stand,
  // leaving two contradictory receipts and no rule for which is the close.
  const want = sha256Hex(`month.closed|${p.month}`);
  if (event.idem !== want)
    throw new SpineError("BAD_MONTH_CLOSE", `month.closed.idem must be sha256("month.closed|"+month) -- a month closes exactly once`);
}

// ---------------------------------------------------------------------------------------------
// THE CRITERIA RECEIPT (ADR-1017 / LED-R)
//
// A PROFILE, not a kind. ADR-1008 requires that a `ventures.yaml` edit is honored only with a
// `decision.recorded` receipt naming the change -- but `decision.recorded`'s payload is CLOSED to
// `decides|verdict|reason` and its idem is welded to `decides`, so a criteria digest has nowhere to
// live inside it except free prose. Matching a digest inside prose is a substring search, and this
// repo has already had one control that was a grep and one mutant that walked past it.
//
// So the digest rides on the `approval.requested` instead, exactly as `policy.promotion`
// (validate-policy.mjs) and `absorb.ab-judgement` (ADR-0603) already do, and the ordinary
// `decision.recorded` decides it by ULID. The closed vocabulary gains ZERO kinds -- which matters,
// because Phase 02 has already committed the next slot to `month.closed`.
export const CRITERIA_SUBJECT = "ledger.criteria";
const CRITERIA_KEYS = Object.freeze(["subject", "digest", "what"]);
const HEX64_RE = /^[0-9a-f]{64}$/;
// `what` is read by a human deciding whether to approve. 512 bytes is prose, not a document.
const MAX_WHAT_BYTES = 512;

export const isCriteriaChange = (event) =>
  Boolean(event) && event.kind === "approval.requested" && isPlainObject(event.payload) &&
  event.payload.subject === CRITERIA_SUBJECT;

// A subject differing only by case or surrounding whitespace is REFUSED, never normalized and never
// exempt -- the near-miss rule absorb learned the hard way. `" Ledger.Criteria "` must not slip past
// `isCriteriaChange` and land as an unvalidated generic approval that the render then trusts.
export const isNearMissCriteriaChange = (event) =>
  Boolean(event) && event.kind === "approval.requested" && isPlainObject(event.payload) &&
  typeof event.payload.subject === "string" &&
  event.payload.subject !== CRITERIA_SUBJECT &&
  event.payload.subject.trim().toLowerCase() === CRITERIA_SUBJECT;

export function assertNotNearMissCriteria(event) {
  throw new SpineError("BAD_LEDGER_CRITERIA",
    `approval.requested subject ${JSON.stringify(event.payload.subject)} differs from ${JSON.stringify(CRITERIA_SUBJECT)} only by case or whitespace -- a near-miss subject is refused, never normalized, because normalizing it would let an unvalidated payload wear a validated subject`);
}

export function assertCriteriaChange(event) {
  const p = event.payload;
  for (const k of Object.keys(p))
    if (!CRITERIA_KEYS.includes(k))
      throw new SpineError("BAD_LEDGER_CRITERIA",
        `approval.requested[${CRITERIA_SUBJECT}] has unknown key ${JSON.stringify(k)} (the profile is closed to ${CRITERIA_KEYS.join("|")})`);
  for (const k of CRITERIA_KEYS)
    if (!(k in p))
      throw new SpineError("BAD_LEDGER_CRITERIA", `approval.requested[${CRITERIA_SUBJECT}] is missing ${JSON.stringify(k)}`);

  // Lowercase hex only. An uppercase or mixed-case spelling of the same digest would compare unequal
  // to the render-side digest and silently read as UNRECEIPTED -- one spelling per digest, refused
  // at the door rather than normalized at every comparison site.
  if (typeof p.digest !== "string" || !HEX64_RE.test(p.digest))
    throw new SpineError("BAD_LEDGER_CRITERIA",
      `approval.requested[${CRITERIA_SUBJECT}].digest ${JSON.stringify(p.digest)} must be a lowercase sha256 hex digest of the CANONICALIZED criteria (never of the file bytes -- see ADR-1017)`);

  if (typeof p.what !== "string" || p.what.length === 0)
    throw new SpineError("BAD_LEDGER_CRITERIA", `approval.requested[${CRITERIA_SUBJECT}].what must be a non-empty string naming the change`);
  const whatBytes = Buffer.byteLength(p.what, "utf8");
  if (whatBytes > MAX_WHAT_BYTES)
    throw new SpineError("BAD_LEDGER_CRITERIA", `approval.requested[${CRITERIA_SUBJECT}].what is ${whatBytes} bytes, ceiling is ${MAX_WHAT_BYTES}`);
  // Control characters would smuggle terminal escapes into the brief and the inbox, both of which
  // print this string verbatim to a human who is about to approve a kill-line change.
  if (hasControlChar(p.what))
    throw new SpineError("BAD_LEDGER_CRITERIA", `approval.requested[${CRITERIA_SUBJECT}].what contains a control character`);

  // WELD THE MECHANICAL KEY TO THE SEMANTIC ONE, for the reason assertDecision spells out: the emit
  // path honours a caller-supplied --idem, so without this an attacker could seal a criteria
  // approval whose digest is a DECOY while its idem pre-claims the stable key of the real digest.
  // The real approval then collides on DUP_IDEM and can never be emitted, while the render keeps
  // reporting the criteria unreceipted and everyone learns to ignore the refusal.
  const want = sha256Hex(`${CRITERIA_SUBJECT}|${p.digest}`);
  if (event.idem !== want)
    throw new SpineError("BAD_LEDGER_CRITERIA",
      `approval.requested[${CRITERIA_SUBJECT}].idem must be sha256("${CRITERIA_SUBJECT}|"+digest) -- a criteria approval's idem is bound to the digest it approves`);
}
