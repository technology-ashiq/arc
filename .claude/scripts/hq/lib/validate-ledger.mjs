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
//      `<provider>` is the SAME provider the payload declares. An email has no such prefix and
//      carries an `@`; a phone number is bare digits; a personal name carries whitespace. None of
//      them can be spelled in this grammar, so no heuristic has to judge whether a string "looks
//      like" a name -- a judgement whose false NEGATIVES would be unrepairable here.
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

import { SpineError } from "./canonical.mjs";

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
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{3,63}$/;
const PLAN_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const RATE_RE = /^(0|[1-9]\d{0,8})\.\d{1,8}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// 32/40/64 lowercase or uppercase hex: md5, sha1, sha256. See the keyed-hash note above.
const BARE_DIGEST_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9A-F]{32}|[0-9A-F]{40}|[0-9A-F]{64})$/;
const INTERVALS = new Set(["monthly", "annual", "one_time"]);
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
  if (!TOKEN_RE.test(token))
    throw new SpineError("BAD_LEDGER_ID", `${field} token ${JSON.stringify(token)} must be 4-64 chars of [A-Za-z0-9_.-] -- an email, a phone number or a personal name cannot be spelled in this grammar, which is the point`);
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
    const token = p.customer_ref.slice(p.customer_ref.indexOf(":") + 1);
    if (BARE_DIGEST_RE.test(token))
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

  // `amount` is re-checked here even though assertMoney already covers it: this module is imported
  // by tests directly, and a validator whose guarantee depends on a sibling being called first is
  // a guarantee about call order rather than about payloads.
  assertMinorUnits(p.amount, "amount", { min: 1 });

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
    if (typeof fx.source !== "string" || !SOURCE_RE.test(fx.source))
      throw new SpineError("BAD_LEDGER_FX", `fx.source ${JSON.stringify(fx.source)} must be a lowercase slug naming where the rate came from`);
    assertCalendarDate(fx.date, "fx.date");
  }
}
