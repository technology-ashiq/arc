// razorpay.mjs — Razorpay settlement export to Appendix C rows (ADR-1015 / LED-C).
//
// COLUMN NAMES BELOW ARE PINNED FROM THE FIXTURE, **NOT** VERIFIED AGAINST A LIVE PROVIDER
// EXPORT — assumptions-ledger row 1 (provider exports obtainable) is FIRED until a real file is
// redacted and pinned. Every name in `COL` is a shape this lane invented; the day a real export
// lands, the diff against that table is the whole of the work, because nothing below depends on
// what a column is CALLED — columns are resolved by name from the header, never by position.
//
// WHY NOT A CSV LIBRARY: a generic reader hands back strings and leaves the two dangerous steps —
// decimal to integer minor units, and the `net = gross - tax - fees` invariant — to a caller who
// will do them with parseFloat. Both live here, once, on the only path into the row shape.
//
// WHY NO FLOAT EVER TOUCHES THE MONEY: "1180.50" becomes 118050 by moving the decimal point with
// string operations and reading the digits as a BigInt. `Math.round(parseFloat(x) * 100)` is the
// exact defect class this lane exists to prevent, and it is lethal precisely because it is right
// for almost every input: 1.005 * 100 is 100.49999999999999. A P&L that is wrong once is never
// trusted again (ADR-1012).
//
// WHY UNRECOGNIZED COLUMNS ARE DROPPED IN SILENCE: the spine is append-only and its closed days
// are immutable, so a customer email that reaches it is on the record permanently and `redact.mjs`
// is secrets-only — there is no later repair (ADR-1002). A settlement export is full of such
// columns: description, notes, contact, the customer name a gateway helpfully attaches. This
// parser emits ONLY the keys Appendix C names. Every other column is read past and never lands in
// an object, so there is no path by which one could be forwarded "just this once". The good
// fixture deliberately carries `customer_email` and a free-text `description` so the drop is
// proven rather than asserted.
//
// WHY NOTHING IS EVER REPAIRED: a malformed row throws, naming the row number and the problem. It
// never returns a shortened list, never skips, never rounds and never warns. A partial list sums
// to a number that looks like money and is not.
//
// TWIN FILE: `parsers/mor.mjs` is the same machine with a different pinned header and a different
// `raw_ref`. The duplication is deliberate — the two are separately attackable, and the lane rule
// is that a hole found in one is re-attacked against the other before either is marked fixed
// (phase-00 spec). A shared helper module would collapse two attack surfaces into one and would
// hide the asymmetry that the merchant-of-record contract test depends on.

import { minorExponent } from "../money.mjs";

const PROVIDER = "razorpay";

// The pinned header. `record_type` is what makes the trailing settlement total a declared record
// rather than a heuristic ("a row with an empty id column") that an attacker could spell.
const COL = Object.freeze({
  recordType: "record_type",
  paymentId: "payment_id",
  settlementId: "settlement_id",
  gross: "gross_amount",
  fees: "fee",
  tax: "tax",
  net: "net_amount",
  currency: "currency",
  settledAt: "settled_at",
  fxRate: "fx_rate",
  fxSource: "fx_source",
  fxDate: "fx_rate_date",
});

const REQUIRED_COLUMNS = Object.freeze([
  COL.recordType, COL.paymentId, COL.settlementId,
  COL.gross, COL.fees, COL.tax, COL.net,
  COL.currency, COL.settledAt,
]);

// Razorpay is the INR rail, so the FX trio is OPTIONAL in the header — but it is REQUIRED, cell by
// cell, on any row whose currency is not INR (ADR-1003). Optional-in-the-header is not
// optional-in-the-row: absence of a column and absence of a rate on a foreign row are different
// failures, and only the second is silent if you conflate them.
const FX_COLUMNS = Object.freeze([COL.fxRate, COL.fxSource, COL.fxDate]);

const TYPE_PAYMENT = "payment";
const TYPE_TOTAL = "settlement_total";

// `provider:token` where token matches Appendix A's grammar. An email carries `@`, a phone number
// is bare digits, a personal name carries whitespace — none can be spelled here, which is why the
// grammar is the PII control and not a detector (ADR-1002).
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{3,63}$/;
// Same spelling as validate-ledger.mjs: a decimal STRING, never a float, because the rate is a
// receipt of what the provider said and a Number cannot carry its own spelling back.
const RATE_RE = /^(0|[1-9]\d{0,8})\.\d{1,8}$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// RFC3339 with an EXPLICIT numeric offset. Bare `Z` is refused on purpose: `Z` and `+00:00` are two
// spellings of one instant, and a row shape with two spellings has two goldens for one file.
const SETTLED_AT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?([+-])(\d{2}):(\d{2})$/;
// No sign, no thousands separator, no currency symbol, no exponent, no leading zeros. The fraction
// length is checked against the currency's minor-unit exponent, not hardcoded to 2.
const DECIMAL_RE = /^(0|[1-9]\d{0,14})(?:\.(\d+))?$/;
// Same ceiling validate-ledger.mjs enforces, applied here so the operator gets a row number instead
// of a spine rejection three steps downstream.
const MAX_MINOR_UNITS = 1000000000000;

const q = (v) => JSON.stringify(v);

// Row numbers are PHYSICAL record numbers in the file, header included, so the number in the
// message is the number the operator's editor shows.
function fail(row, message) {
  throw new Error(`${PROVIDER} export: row ${row}: ${message}`);
}
function failFile(message) {
  throw new Error(`${PROVIDER} export: ${message}`);
}

// RFC4180 tokenizer. Quoted fields may contain commas, doubled quotes and line breaks; CRLF, LF and
// a lone CR all terminate a record outside quotes, so a Windows-authored export and a unix one
// parse identically. Records keep their physical number even when blank, because a blank line must
// not shift the row number in an error message.
function splitRecords(text) {
  const records = [];
  let fields = [];
  let field = "";
  let inQuotes = false;
  let quotedField = false;
  let n = 1;

  const endField = () => {
    fields.push(field);
    field = "";
    quotedField = false;
  };
  const endRecord = () => {
    endField();
    records.push({ n, fields });
    fields = [];
    n += 1;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') { field += ch; continue; }
      if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
      // The quote CLOSES the field, so the only thing that may follow is a delimiter, a line
      // terminator, or end of input. Without this, everything after the closing quote was appended
      // to the value: `"1180"00` parsed as 118000 minor units where 1180.00 was written -- a 100x
      // error that leaves `net == gross - tax - fees` intact and therefore passes every other
      // check in the lane. Found by the Phase-00 adversarial pass; the twin fix is in mor.mjs.
      const after = text[i + 1];
      if (after !== undefined && after !== "," && after !== "\n" && after !== "\r")
        fail(n, `data follows a closing quote in column ${fields.length + 1} -- a closed quoted field must be followed by a delimiter or a line ending, never by more characters`);
      inQuotes = false;
      continue;
    }
    if (ch === '"') {
      // A quote may only OPEN a field. `a"b` and `"a"b` are malformed rather than "probably meant
      // literally" — guessing here is how a smuggled delimiter becomes a silently different row.
      if (field.length > 0 || quotedField)
        fail(n, `a double quote appears inside an unquoted field in column ${fields.length + 1} — a quote may only open a field`);
      inQuotes = true;
      quotedField = true;
      continue;
    }
    if (ch === ",") { endField(); continue; }
    if (ch === "\n") { endRecord(); continue; }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i += 1;
      endRecord();
      continue;
    }
    field += ch;
  }

  if (inQuotes) fail(n, "a quoted field is never closed — the file ends inside a quote");
  // A pending fragment is the last record of a file with no trailing newline. Nothing pending means
  // the file ended ON a terminator, which adds no record.
  if (field.length > 0 || fields.length > 0 || quotedField) endRecord();
  return records;
}

const isBlank = (record) => record.fields.length === 1 && record.fields[0] === "";

// Header names are labels a provider capitalizes at whim, so they are matched case-insensitively
// after trimming. Data cells are NOT normalized anywhere below — a case-varied enum or currency is
// refused rather than folded, because folding data is how two spellings become one silent value
// (spine hostile corpus, council v2 class). The asymmetry is deliberate: a label is not a value.
function indexHeader(record) {
  const index = new Map();
  record.fields.forEach((raw, i) => {
    const name = raw.trim().toLowerCase();
    if (name === "") return; // an unnamed column is dropped like any other unrecognized one
    if (index.has(name))
      failFile(`header names column ${q(name)} twice (positions ${index.get(name) + 1} and ${i + 1}) — resolving it by name would silently pick one of two columns`);
    index.set(name, i);
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !index.has(c));
  if (missing.length > 0)
    failFile(`header is missing required column(s): ${missing.join(", ")}. Present: ${[...index.keys()].join(", ") || "(none)"}`);
  return index;
}

function exponentFor(currency, row) {
  if (!/^[A-Z]{3}$/.test(currency))
    fail(row, `currency ${q(currency)} must be an uppercase ISO-4217 code — a case-varied code is refused, not normalized`);
  try {
    return minorExponent(currency);
  } catch {
    fail(row, `currency ${q(currency)} has no pinned minor-unit exponent — v1 is INR plus USD (ADR-1013), and a third currency needs its own fixtures before a row of it can be summed`);
  }
}

// A decimal string to an INTEGER count of minor units, by string manipulation only. The digits are
// read with BigInt, so nothing here is representable-but-wrong the way a float would be.
function toMinorUnits(raw, currency, exponent, field, row) {
  if (raw === "") fail(row, `${field} is empty — an absent amount is not zero, and a zero that was never stated would sum as if it had been`);
  if (raw !== raw.trim()) fail(row, `${field} ${q(raw)} carries surrounding whitespace — trimming money is a silent repair`);
  if (raw.startsWith("-"))
    fail(row, `${field} ${q(raw)} is negative — a refund or chargeback row is not part of the Appendix C row shape in v1, and inventing one here would pin a contract the PLAN has not written`);
  const m = DECIMAL_RE.exec(raw);
  if (!m)
    fail(row, `${field} ${q(raw)} must be a plain decimal such as "1180.50" — no sign, no thousands separator, no currency symbol, no exponent, no leading zeros`);
  const frac = m[2] ?? "";
  if (frac.length > exponent)
    fail(row, `${field} ${q(raw)} carries ${frac.length} decimal places but ${currency} has ${exponent} — a value finer than the minor unit cannot be recorded without rounding, and rounding money at parse time is the defect this lane exists to prevent (ADR-1012)`);
  // The whole point, in one line: shift the decimal point by padding, then read digits. No float.
  const minor = BigInt(m[1] + frac.padEnd(exponent, "0"));
  if (minor > BigInt(MAX_MINOR_UNITS))
    fail(row, `${field} ${q(raw)} is beyond any real payment (> ${MAX_MINOR_UNITS} minor units)`);
  return Number(minor); // bounded by MAX_MINOR_UNITS, far below Number.MAX_SAFE_INTEGER
}

function assertToken(raw, field, row) {
  if (raw === "") fail(row, `${field} is empty`);
  if (raw.includes(":"))
    fail(row, `${field} ${q(raw)} already carries a namespace separator — this column holds the BARE provider token and the ${PROVIDER}: prefix is added here, exactly once`);
  if (!TOKEN_RE.test(raw))
    fail(row, `${field} ${q(raw)} must be 4-64 characters of [A-Za-z0-9_.-] starting alphanumeric — an email, a phone number or a personal name cannot be spelled in this grammar, which is the point (ADR-1002)`);
  return raw;
}

function assertCalendarDate(y, mo, d) {
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

// Returned VERBATIM. `settled_at` is the provider's own receipt of when the money moved, and a
// parser that re-formats it has replaced evidence with its own opinion of the same instant.
function assertSettledAt(raw, row) {
  if (raw === "") fail(row, `${COL.settledAt} is empty`);
  const m = SETTLED_AT_RE.exec(raw);
  if (!m)
    fail(row, `${COL.settledAt} ${q(raw)} must be RFC3339 with an explicit numeric offset, e.g. "2026-09-14T10:04:11+05:30" — a bare Z is refused because Z and +00:00 are two spellings of one instant`);
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const offH = Number(m[9]);
  const offM = Number(m[10]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) fail(row, `${COL.settledAt} ${q(raw)}: month or day out of range`);
  if (h > 23 || mi > 59 || s > 59) fail(row, `${COL.settledAt} ${q(raw)}: time out of range`);
  if (offH > 14 || offM > 59) fail(row, `${COL.settledAt} ${q(raw)}: UTC offset out of range`);
  if (!assertCalendarDate(y, mo, d)) fail(row, `${COL.settledAt} ${q(raw)} is not a real calendar date`);
  return raw;
}

// FX is a receipt, not a lookup (ADR-1003): required on a non-INR row, forbidden on an INR one. An
// INR row carrying a rate has a conversion nobody performed; a foreign row without one can only be
// converted at render, which is what breaks replay.
function readFx(cell, currency, row) {
  const rate = cell(COL.fxRate);
  const source = cell(COL.fxSource);
  const date = cell(COL.fxDate);
  const present = [rate, source, date].filter((v) => v !== "").length;

  if (currency === "INR") {
    if (present > 0)
      fail(row, `currency is INR but ${FX_COLUMNS.join("/")} carries a value — an INR row must not record a conversion nobody performed`);
    return undefined;
  }
  if (present !== 3)
    fail(row, `currency ${q(currency)} is not INR, so ${FX_COLUMNS.join(", ")} are all required on this row (ADR-1003) — a foreign row without a rate can only be converted at render, which is what breaks replay`);
  if (!RATE_RE.test(rate))
    fail(row, `${COL.fxRate} ${q(rate)} must be a decimal string such as "83.20" — a float cannot carry its own spelling, and this value is a receipt (ADR-1012)`);
  if (!SOURCE_RE.test(source))
    fail(row, `${COL.fxSource} ${q(source)} must be a lowercase slug naming where the rate came from`);
  const dm = DATE_RE.exec(date);
  if (!dm || !assertCalendarDate(Number(dm[1]), Number(dm[2]), Number(dm[3])))
    fail(row, `${COL.fxDate} ${q(date)} must be a real calendar date as YYYY-MM-DD`);
  return { rate, source, date };
}

/**
 * Parse a Razorpay settlement export into Appendix C rows.
 *
 * @param {string} text  the export file as text (UTF-8 BOM, CRLF and a missing final newline all
 *                       tolerated; nothing else about the bytes is guessed at)
 * @returns {Array<object>} one flat row per settled payment, in file order
 * @throws {Error} naming the row number and the problem. Never a partial list.
 */
export function parseRazorpayExport(text) {
  if (typeof text !== "string") failFile("input must be a string of the export file's text");
  // The BOM is stripped at position 0 only. A BOM anywhere else is a data byte and will fail the
  // grammar of whatever cell it landed in, which is the correct outcome rather than a silent strip.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (body === "") failFile("file is empty — a settlement export with no header is not an empty settlement");

  const records = splitRecords(body);
  if (records.length === 0 || isBlank(records[0]))
    failFile("record 1 is empty — the header must be the file's first record");

  const header = records[0];
  const index = indexHeader(header);
  const width = header.fields.length;

  const rows = [];
  let total = null; // the file's own declared settlement total, if it carries one
  let sum = { gross: 0n, fees: 0n, tax: 0n, net: 0n };
  let sumCurrency = null;
  let mixedCurrency = false;

  for (const record of records.slice(1)) {
    const row = record.n;
    if (isBlank(record)) continue; // a blank line adds no data and still burns its row number
    if (record.fields.length !== width)
      fail(row, `has ${record.fields.length} field(s) but the header declares ${width} — a short or long record cannot be resolved by name`);
    if (total !== null)
      fail(row, `a record follows the ${TYPE_TOTAL} record on row ${total.row} — the declared total must be the file's last record, or it is a total of something other than what follows it`);

    const cell = (name) => (index.has(name) ? record.fields[index.get(name)] : "");
    const type = cell(COL.recordType);
    if (type !== TYPE_PAYMENT && type !== TYPE_TOTAL)
      fail(row, `${COL.recordType} ${q(type)} must be exactly ${q(TYPE_PAYMENT)} or ${q(TYPE_TOTAL)} — a case-varied or unknown record type is refused rather than normalized, because a type nobody recognizes is a row nobody sums`);

    const currency = cell(COL.currency);
    const exponent = exponentFor(currency, row);
    const money = (name) => toMinorUnits(cell(name), currency, exponent, name, row);
    const gross = money(COL.gross);
    const fees = money(COL.fees);
    const tax = money(COL.tax);
    const net = money(COL.net);
    // The invariant, as a rule rather than a pattern read off one worked example (Appendix A).
    if (net !== gross - tax - fees)
      fail(row, `${COL.net} ${net} must equal ${COL.gross} - ${COL.tax} - ${COL.fees} (${gross} - ${tax} - ${fees} = ${gross - tax - fees}) in minor units`);

    if (type === TYPE_TOTAL) {
      // The total is a checksum, not a payment. It carries no payment identity and no timestamp;
      // allowing it any would let a real payment hide inside the row that is exempt from the sum.
      for (const name of [COL.paymentId, COL.settlementId, COL.settledAt])
        if (cell(name) !== "")
          fail(row, `the ${TYPE_TOTAL} record must leave ${name} empty — it is a checksum over the payment rows, not one of them`);
      for (const name of FX_COLUMNS)
        if (cell(name) !== "")
          fail(row, `the ${TYPE_TOTAL} record must leave ${name} empty — a total is stated in the settlement currency and converts nothing`);
      total = { row, gross, fees, tax, net, currency };
      continue;
    }

    const settledAt = assertSettledAt(cell(COL.settledAt), row);
    const paymentId = assertToken(cell(COL.paymentId), COL.paymentId, row);
    const settlementId = assertToken(cell(COL.settlementId), COL.settlementId, row);
    const fx = readFx(cell, currency, row);

    if (sumCurrency === null) sumCurrency = currency;
    else if (sumCurrency !== currency) mixedCurrency = true;
    sum = {
      gross: sum.gross + BigInt(gross),
      fees: sum.fees + BigInt(fees),
      tax: sum.tax + BigInt(tax),
      net: sum.net + BigInt(net),
    };

    // Key order is Appendix C's order, fixed, so a golden compares byte for byte. Duplicate
    // payment ids are NOT rejected here: a natural-key duplicate is a render-time flag (ADR-1010),
    // and a parser that deduped would delete the evidence the flag exists to show.
    const out = {
      provider: PROVIDER,
      provider_payment_id: `${PROVIDER}:${paymentId}`,
      gross,
      fees,
      tax,
      net,
      currency,
      settled_at: settledAt,
    };
    if (fx !== undefined) out.fx = fx;
    // `raw_ref` proves the row came from THIS provider's real format. Razorpay carries
    // settlement_id; the merchant-of-record rail carries settlement_batch_id, and that asymmetry is
    // what stops a swapped-in parser or a stub of the shared type from passing the contract test.
    out.raw_ref = { settlement_id: settlementId };
    rows.push(out);
  }

  if (total !== null) {
    if (mixedCurrency || (sumCurrency !== null && sumCurrency !== total.currency))
      fail(total.row, `the ${TYPE_TOTAL} record is stated in ${q(total.currency)} but the payment rows are not all in that currency — a settlement total cannot span two currencies`);
    for (const key of ["gross", "fees", "tax", "net"]) {
      if (BigInt(total[key]) !== sum[key])
        fail(total.row, `the ${TYPE_TOTAL} record declares ${key} ${total[key]} but the ${rows.length} payment row(s) sum to ${sum[key]} minor units — the export disagrees with itself, and a missed or doubled row is exactly what that looks like`);
    }
  }

  return rows;
}
