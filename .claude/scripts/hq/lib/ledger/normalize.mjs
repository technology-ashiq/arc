// normalize.mjs — an Appendix C parser row becomes an Appendix A revenue payload.
//
// THIS IS WHERE THE TIMEZONE HAZARD ACTUALLY LIVES, and it is worth being precise about why,
// because the plan originally aimed the fixture at the wrong layer. Event timestamps on the spine
// cannot be non-IST: `IST_TS_RE` REQUIRES the `+05:30` offset, so a wrong-zone `ts` is refused at
// ingest and month bucketing over spine events is exact by construction. But a settlement export
// is written in the provider's zone -- the merchant-of-record rail settles in UTC -- and the
// conversion from that to an IST instant happens HERE, once, on the only path from a file to an
// event. A payment settled at 18:45 UTC on the 14th belongs to the 15th in IST, and at a month
// boundary that is the difference between two months of P&L.
//
// The parsers deliberately do NOT convert: a parsed row is a receipt of what the file said, and a
// receipt that has been silently shifted is no longer evidence of anything.

import { SpineError, formatIst } from "../canonical.mjs";

// gross = amount + tax (PLAN Appendix A), so the ex-tax figure the whole MRR base is built on is
// recovered by subtraction rather than by trusting a column no export is guaranteed to carry.
function exTaxAmount(row) {
  const amount = row.gross - row.tax;
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw new SpineError("BAD_LEDGER_MONEY", `row ${row.provider_payment_id}: gross ${row.gross} minus tax ${row.tax} is ${amount}, which is not a positive integer amount`);
  return amount;
}

/**
 * Convert an RFC3339 instant in any offset to the canonical IST spelling this spine accepts.
 * Reuses formatIst rather than re-deriving the shift: two implementations of one conversion drift,
 * and the one in canonical.mjs is the one every other receipt on the spine was written with.
 */
export function toIst(instant) {
  if (typeof instant !== "string")
    throw new SpineError("BAD_LEDGER_TS", "settled_at must be a string");
  const ms = Date.parse(instant);
  if (!Number.isFinite(ms))
    throw new SpineError("BAD_LEDGER_TS", `settled_at ${JSON.stringify(instant)} is not an RFC3339 instant`);
  // An instant with NO offset is refused rather than assumed local: "assume the machine's zone" is
  // how a CI runner in UTC and a laptop in IST disagree about which month a payment belongs to.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(instant))
    throw new SpineError("BAD_LEDGER_TS", `settled_at ${JSON.stringify(instant)} carries no UTC offset -- an instant without a zone is not an instant`);
  return formatIst(ms);
}

/**
 * row  — one Appendix C row from a parser
 * meta — the facts no settlement export knows: { venture, plan, interval, customer_ref }
 *
 * Returns { payload, ts } — the payload for `arc-event ingest revenue.received --json`, and the
 * IST instant the caller should stamp it with.
 */
export function normalizeRow(row, meta = {}) {
  if (!row || typeof row !== "object") throw new SpineError("BAD_LEDGER_ROW", "row must be an object");
  if (typeof meta.venture !== "string" || meta.venture === "")
    throw new SpineError("BAD_LEDGER_ROW", `row ${row.provider_payment_id}: a venture must be supplied -- no settlement export knows which product earned the money`);

  const payload = {
    amount: exTaxAmount(row),
    currency: row.currency,
    venture: meta.venture,
    provider: row.provider,
    provider_payment_id: row.provider_payment_id,
    gross: row.gross,
    fees: row.fees,
    tax: row.tax,
    net: row.net,
  };

  // Optional operator facts. Absent stays absent: an unset plan is not the empty string, and
  // writing one would put a value on an append-only log that nobody chose.
  if (meta.plan !== undefined) payload.plan = meta.plan;
  if (meta.interval !== undefined) payload.interval = meta.interval;
  if (meta.customer_ref !== undefined) payload.customer_ref = meta.customer_ref;
  if (row.fx !== undefined) payload.fx = row.fx;

  return { payload, ts: toIst(row.settled_at) };
}

export function normalizeRows(rows, meta = {}) {
  return rows.map((r) => normalizeRow(r, meta));
}
