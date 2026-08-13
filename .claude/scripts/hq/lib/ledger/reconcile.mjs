// reconcile.mjs -- the month-close reconciliation gate (REQ-05, ADR-1005 / LED-F, ADR-1015 / LED-P).
//
// THIS MODULE DECIDES WHETHER A MONTH MAY BE CLOSED, and does nothing else. It emits nothing,
// writes nothing, and touches the spine only through the reader (ADR-1000 / LED-A). Only a green
// gate may be followed by a `month.closed`, and building that payload is the last function here.
// `.claude/scripts/review/spine-reader-lint.sh` scans `lib/ledger/` for real now -- it used to
// exempt every lib SUBDIRECTORY, so 33 of 63 files were never opened -- and this file is subject
// to it.
//
// A RAIL IS ONE PROVIDER ACCOUNT SETTLING INTO ONE CURRENCY: `(provider, currency)`. Razorpay and
// a merchant-of-record account are two rails, and each reconciles separately against its own total
// (ADR-1005). Nothing finer is attempted in v1; the rabbit hole named in the phase spec is
// reconciling anything other than a per-rail total.
//
// THE GATE BLOCKS IN BOTH DIRECTIONS, and the two directions are different investigations:
//
//   spine < provider (SHORTFALL) -- the provider settled money this spine has no payment for. What
//     a reader needs is the gap plus the ids already recorded, because finding the missing ones is
//     a diff against the provider export and nothing else.
//   spine > provider (EXCESS) -- the spine holds payments the provider did not settle. The first
//     suspect is a `provider_payment_id` recorded twice, so those ids are named with their counts.
//
// THE THIRD CASE IS THE SHARP ONE. A rail on the spine with NO input blocks exactly as a
// mismatched one does, and `provider_minor` for such a rail is NULL, never 0. A rail that
// genuinely settled nothing sums to 0 on the spine as well, so defaulting an absent input to 0
// would make that rail compare EQUAL and close the month green having checked nothing. "No input"
// and "matches" must never render the same -- that is the close this gate exists to prevent.
//
// THERE IS NO TOLERANCE. Money is an integer count of minor units (ADR-1012 / LED-M) and either
// matches or does not: no rounding, no epsilon, no "close enough", and no float anywhere below.
// Sums stay in the rail's OWN currency -- the provider settles in its own currency, so the
// comparison is like with like and `money.mjs`'s converter is deliberately not imported here. A
// converted total would make the gate a function of an exchange rate.
//
// EVERY BLOCKER CARRIES ALL THREE NUMBERS -- `gross_minor`, `refund_minor`, `net_minor` -- and not
// only the one being compared. A settlement total is NET of refunds under the standard reading, and
// that is the reading this gate ships. But assumptions-ledger row 1 (provider settlement exports
// are obtainable) is FIRED: no real export was available offline, both parsers are pinned to a
// documented synthetic corpus, and so nobody in this lane has yet seen which convention a real
// settlement file uses. A provider that reports GROSS would make every refunded month fail by
// exactly `refund_minor` -- printing all three numbers turns that from a debugging session into a
// single read. When the first real export lands, this is the line that tells us which way to go.

import { createHash } from "node:crypto";
import { SpineError, sha256Hex } from "../canonical.mjs";
import { query } from "../../spine.mjs";
import { derivePnl } from "./pnl.mjs";

// ONE kind is read. `revenue.simulated` is excluded STRUCTURALLY and never filtered at the end
// (REQ-01): simulated money must not be able to reconcile a real month green.
const REAL_KIND = "revenue.received";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// Same spellings validate-ledger.mjs enforces at ingest, restated here rather than imported,
// because this module is loaded directly by tests and a guarantee that depends on a sibling having
// run first is a guarantee about call order.
const PROVIDER_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const MAX_MINOR_UNITS = 1000000000000;

// The two input paths of ADR-1015, and the only two `assertMonthClosed` accepts.
export const SOURCES = Object.freeze(["file", "total"]);
const INPUT_KEYS = Object.freeze(["provider", "currency", "total_minor", "source", "input_sha"]);

// Blocker kinds. Each is a DIFFERENT investigation, so each is its own kind rather than one
// MISMATCH carrying a sign: a reader who has to work out the direction from the sign of a number
// is a reader who reads it wrong once.
export const BLOCKER = Object.freeze({
  NO_RAILS: "NO-RAILS",
  NO_INPUT: "NO-INPUT",
  NO_SPINE_RAIL: "NO-SPINE-RAIL",
  NET_NEGATIVE: "NET-NEGATIVE",
  SHORTFALL: "SHORTFALL",
  EXCESS: "EXCESS",
  INPUT_CONFLICT: "INPUT-CONFLICT",
  INPUT_DUPLICATE_SOURCE: "INPUT-DUPLICATE-SOURCE",
  INPUT_INVALID: "INPUT-INVALID",
});

export const RAIL_STATUS = Object.freeze({
  MATCHED: "MATCHED",
  SHORTFALL: "SHORTFALL",
  EXCESS: "EXCESS",
  NO_INPUT: "NO-INPUT",
  NO_SPINE_RAIL: "NO-SPINE-RAIL",
  NET_NEGATIVE: "NET-NEGATIVE",
  UNRESOLVED_INPUT: "UNRESOLVED-INPUT",
});

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const q = (v) => JSON.stringify(v);

// ONE SPELLING OF THE RAIL KEY, exported so nothing invents a second. `|` is safe as the separator
// for the same reason validate-ledger.mjs uses it: a provider is `[a-z0-9-]` and a currency is
// three uppercase letters, so neither half can contain it and no two rails can collide.
export function railKey({ provider, currency }) {
  return `${provider}|${currency}`;
}

// CODE-UNIT COMPARE, NEVER `localeCompare`. ICU collation depends on the machine's locale data, and
// this output is byte-compared across three CI legs -- a sort that is stable on one leg and not on
// another is a golden that fails for a reason nobody can reproduce.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byRail = (a, b) => cmp(a.provider, b.provider) || cmp(a.currency, b.currency);

function assertMonth(month) {
  if (typeof month !== "string" || !MONTH_RE.test(month))
    throw new SpineError("BAD_MONTH", `month ${q(month)} must be YYYY-MM`);
}

// ---------------------------------------------------------------------------------------------
// THE SPINE SIDE
//
// MONTH BUCKETING IS EXACT AND DOES NO ZONE MATH. Every `ts` on this spine matches IST_TS_RE,
// which REQUIRES the +05:30 offset (canonical.mjs), so a non-IST timestamp cannot reach here at
// all and `ts.slice(0, 7)` IS the IST month. Converting here would be the second zone conversion
// in this lane; normalize.mjs owns the only one.
//
// REFUNDS ARE NETTED, AND THE LINK RULES ARE NOT SPELLED TWICE.
//
// A refund is a `revenue.received` carrying `refund_of` (ADR-1016 / LED-Q) with a POSITIVE amount,
// and a provider settlement total is net of the refunds the provider processed. So the compared
// number is `net_minor = gross_minor - refund_minor`. Charges-only would be arithmetically tidy and
// operationally useless: every month containing a single refund could never close, and a gate that
// blocks the ordinary case is one people learn to route around.
//
// WHICH refunds count is decided by FIVE rules -- the charge is on the spine, it is not itself a
// refund, same venture, same currency, not dated before its charge -- and `derivePnl` in pnl.mjs
// already applies all five and is green on CI. So this module READS that linkage out of
// `pnl.refundLinks` (one additive field on its return) and re-derives nothing. A second copy of
// five rules is a second thing to keep in step, and this lane has paid for that twice.
//
// THE CHARGE SUM IS STILL TAKEN FROM THE RAW EVENTS, deliberately. `derivePnl` EXCLUDES
// natural-key duplicates from its totals (ADR-1010 / LED-K), which is right for a P&L and wrong
// here: a payment entered twice is exactly the EXCESS this gate exists to catch, and reading the
// charge sum from a view that has already dropped both copies would turn that excess into a
// shortfall and send the operator hunting for a payment that is not missing.
//
// A refund that did NOT link is money the provider may well have deducted while this gate does not
// subtract it, so it is surfaced as `unlinked_refund_minor` rather than dropped. It is a needs-you
// item in `arc pnl`, and naming it here is what stops the resulting shortfall reading as a mystery.
//
// TWO READS OF THE SPINE happen here, one for the raw charge sum and one inside `derivePnl`. No
// cache is a lane rule (ADR-1014) and the spine is append-only, so the second read can only be a
// superset of the first. The asymmetry is in the safe direction: a charge appended between the two
// is missed by the sum and can only make the rail look SHORT, never green.
/**
 * Sum the spine side of a month, per rail, in each rail's OWN currency and minor units.
 *
 * @returns {{month: string, engine: string, paymentCount: number, rails: Array<object>}}
 *          `rails` sorted by (provider, currency); each carries the trichotomy `gross_minor` /
 *          `refund_minor` / `net_minor`, plus `spine_minor` (the compared figure, which IS
 *          `net_minor` -- one expression assigns both so they cannot drift, and the second name
 *          exists because that is what the `month.closed` receipt calls it), the charge and refund
 *          counts and id lists, and `unlinked_refund_minor`. `paymentCount` counts every
 *          `revenue.received` in the month, charges and refunds alike -- the receipt's "how many
 *          payment events did this close cover", not the number that was summed.
 */
export async function deriveRails(root, { month, engine } = {}) {
  assertMonth(month);

  const res = await query(root, { engine });
  // The reader returns RECORDS -- {event, day, seq, line} -- not bare events. Reading `.kind` off a
  // record yields undefined for every event, and a filter on undefined quietly matches nothing.
  const events = res.events.map((r) => r.event);

  const rails = new Map();
  const railFor = (provider, currency) => {
    const key = railKey({ provider, currency });
    let r = rails.get(key);
    if (r === undefined) {
      r = {
        provider, currency,
        gross_minor: 0, charge_count: 0, charge_payment_ids: [],
        refund_minor: 0, refund_count: 0, refund_payment_ids: [],
        refund_recorded_minor: 0, refund_recorded_count: 0,
      };
      rails.set(key, r);
    }
    return r;
  };
  let paymentCount = 0;

  for (const e of events) {
    if (e.kind !== REAL_KIND) continue;
    if (typeof e.ts !== "string" || e.ts.slice(0, 7) !== month) continue;
    const p = e.payload;

    // A REVENUE EVENT THIS GATE CANNOT NAME A RAIL FOR IS A HARD REFUSAL, never a skip. Skipping
    // it would understate the spine side by exactly its amount, and understating the spine side is
    // how a shortfall disappears -- a silent green is the one outcome this module may never
    // produce. Ingest validation already guarantees these fields; this is the second lock.
    if (!isPlainObject(p) || typeof p.provider !== "string" || !PROVIDER_RE.test(p.provider))
      throw new SpineError("BAD_LEDGER_RAIL",
        `${REAL_KIND} ${q(e.id)} in ${month} carries provider ${q(isPlainObject(p) ? p.provider : undefined)}, which names no rail -- skipping it would understate the spine side of the gate by its own amount`);
    if (typeof p.currency !== "string" || !CURRENCY_RE.test(p.currency))
      throw new SpineError("BAD_LEDGER_RAIL",
        `${REAL_KIND} ${q(e.id)} in ${month} carries currency ${q(p.currency)}, which names no rail -- a rail is one provider account settling into one currency`);
    if (typeof p.provider_payment_id !== "string")
      throw new SpineError("BAD_LEDGER_RAIL",
        `${REAL_KIND} ${q(e.id)} in ${month} has no string provider_payment_id -- the excess branch names duplicate suspects by that id and cannot name one it does not have`);
    // Integer minor units or nothing. A float amount would make the sum a float, which is the
    // whole of ADR-1012 undone in one addition.
    if (!Number.isSafeInteger(p.amount) || p.amount < 0)
      throw new SpineError("BAD_LEDGER_MONEY",
        `${REAL_KIND} ${q(e.id)} has amount ${q(p.amount)}, which must be a non-negative integer count of minor units (ADR-1012)`);

    const r = railFor(p.provider, p.currency);
    paymentCount += 1;
    if ("refund_of" in p) {
      // RECORDED, not yet subtracted. Whether this refund counts is `derivePnl`'s call, below.
      r.refund_recorded_count += 1;
      r.refund_recorded_minor += p.amount;
    } else {
      r.charge_count += 1;
      r.gross_minor += p.amount;
      r.charge_payment_ids.push(p.provider_payment_id);
    }
  }

  // THE LINKAGE, read rather than re-derived. `month: null` because the month bucketing is done
  // here, on the refund's OWN `ts`: pnl.mjs applies a refund in the month it was RECORDED, and
  // asking it to filter as well would make two places responsible for one rule.
  const pnl = await derivePnl(root, { mode: "real", venture: null, month: null, engine });
  for (const link of pnl.refundLinks) {
    if (typeof link.ts !== "string" || link.ts.slice(0, 7) !== month) continue;
    const r = railFor(link.provider, link.currency);
    r.refund_count += 1;
    r.refund_minor += link.amount;
    r.refund_payment_ids.push(link.paymentId);
  }

  // Sorted, because these arrays reach a byte-compared render and the duplicate scan below reads
  // them. Spine append order is not a fact about the month; it is a fact about the ingest session.
  const out = [...rails.values()].sort(byRail);
  for (const r of out) {
    const net = r.gross_minor - r.refund_minor;
    // ONE expression, two names. `net_minor` is the arithmetic and `spine_minor` is what the
    // `month.closed` receipt calls the same number; assigning them separately is how they drift.
    r.net_minor = net;
    r.spine_minor = net;
    r.unlinked_refund_minor = r.refund_recorded_minor - r.refund_minor;
    r.unlinked_refund_count = r.refund_recorded_count - r.refund_count;
    r.charge_payment_ids.sort(cmp);
    r.refund_payment_ids.sort(cmp);
  }

  return { month, engine: res.engine, paymentCount, rails: out };
}

// ---------------------------------------------------------------------------------------------
// THE INPUT SIDE
//
// A reconciliation input is CLOSED to five keys. An unknown key is refused rather than ignored:
// this object is how a provider's number enters a gate that can freeze a month, and a field
// nothing reads is a field an operator believes is being read.
function inputProblem(raw) {
  if (!isPlainObject(raw)) return { field: "(input)", why: "must be an object" };
  for (const k of Object.keys(raw))
    if (!INPUT_KEYS.includes(k))
      return { field: k, why: `unknown key -- a reconciliation input is closed to ${INPUT_KEYS.join("|")}` };
  for (const k of INPUT_KEYS) if (!(k in raw)) return { field: k, why: "is absent" };

  if (typeof raw.provider !== "string" || !PROVIDER_RE.test(raw.provider))
    return { field: "provider", why: "must be a lowercase slug naming the provider account" };
  if (typeof raw.currency !== "string" || !CURRENCY_RE.test(raw.currency))
    return { field: "currency", why: "must be a 3-letter uppercase ISO-4217 code -- a rail settles into exactly one" };
  // NEVER ROUNDED, NEVER PARSED FROM A DECIMAL HERE. The CLI turns "1180.50" into 118050 on the
  // way in (the export parsers do it by string manipulation, ADR-1012); what arrives here is
  // already an integer or it is an operator error.
  if (!Number.isSafeInteger(raw.total_minor) || raw.total_minor < 0)
    return { field: "total_minor", why: "must be a non-negative integer count of minor units (ADR-1012) -- a decimal, a string or a float is refused rather than rounded" };
  if (raw.total_minor > MAX_MINOR_UNITS)
    return { field: "total_minor", why: `is beyond any real settlement (> ${MAX_MINOR_UNITS} minor units)` };
  if (!SOURCES.includes(raw.source))
    return { field: "source", why: `must be one of ${SOURCES.join("|")}` };
  if (typeof raw.input_sha !== "string" || !HEX64_RE.test(raw.input_sha))
    return { field: "input_sha", why: "must be a lowercase sha256 of the bytes this number came from -- a receipt that names a number without pinning what it came from is a receipt of nothing" };
  return null;
}

// The rail an input names, or null when it cannot be named. A blocker about an input whose
// provider or currency is itself malformed must not invent a rail to hang itself on.
function railOf(raw) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.provider !== "string" || !PROVIDER_RE.test(raw.provider)) return null;
  if (typeof raw.currency !== "string" || !CURRENCY_RE.test(raw.currency)) return null;
  return { provider: raw.provider, currency: raw.currency };
}

// ---------------------------------------------------------------------------------------------
// THE DECISION
/**
 * Reconcile a month's spine rails against the provider inputs.
 *
 * @param {{rails: Array<object>, inputs: Array<object>}} args  `rails` from `deriveRails`;
 *        `inputs` a list of {provider, currency, total_minor, source, input_sha}.
 * @returns {{ok: boolean, rails: Array<object>, blockers: Array<object>}}
 *          `ok` is true ONLY when there is at least one rail, every spine rail has an input, every
 *          input names a real rail, and every pair matches EXACTLY.
 */
export function reconcile({ rails = [], inputs = [] } = {}) {
  if (!Array.isArray(rails)) throw new SpineError("BAD_RECONCILE", "rails must be an array");
  if (!Array.isArray(inputs)) throw new SpineError("BAD_RECONCILE", "inputs must be an array");

  const blockers = [];

  const spineByKey = new Map();
  for (const r of rails) {
    const key = railKey(r);
    if (spineByKey.has(key))
      throw new SpineError("BAD_RECONCILE",
        `two spine rows for rail ${key} -- a rail is one provider account settling into one currency and it reconciles once; two rows would let one matching and one mismatching row coexist`);
    spineByKey.set(key, r);
  }

  // ALL THREE NUMBERS ON EVERY BLOCKER, including the ones that are about an input rather than a
  // mismatch -- see the header on the FIRED assumption. Null (never 0) when the spine has no such
  // rail: "no rail" and "a rail that settled nothing" are different facts.
  const moneyOf = (rail) => {
    const found = rail === null || rail === undefined ? undefined : spineByKey.get(railKey(rail));
    return found === undefined
      ? { gross_minor: null, refund_minor: null, net_minor: null }
      : { gross_minor: found.gross_minor, refund_minor: found.refund_minor, net_minor: found.net_minor };
  };

  // Group the inputs by rail, refusing malformed ones as they go by. Each bad input is reported on
  // its own rather than aborting on the first: an operator fixing a close wants every problem in
  // one pass, not one per run.
  const inputsByKey = new Map();
  const refusedKeys = new Set(); // rails that HAD input and whose input was refused
  inputs.forEach((raw, index) => {
    const problem = inputProblem(raw);
    const rail = railOf(raw);
    if (problem !== null) {
      blockers.push({ kind: BLOCKER.INPUT_INVALID, rail, ...moneyOf(rail), index, field: problem.field, problem: problem.why });
      if (rail !== null) refusedKeys.add(railKey(rail));
      return;
    }
    const key = railKey(raw);
    if (!inputsByKey.has(key)) inputsByKey.set(key, []);
    inputsByKey.get(key).push({
      provider: raw.provider,
      currency: raw.currency,
      total_minor: raw.total_minor,
      source: raw.source,
      input_sha: raw.input_sha,
      index,
    });
  });

  // Resolve each rail's inputs to at most one number.
  const resolved = new Map();
  for (const [key, list] of inputsByKey) {
    const rail = { provider: list[0].provider, currency: list[0].currency };

    // TWO INPUTS OF THE SAME SOURCE IS AN OPERATOR ERROR, NOT A LAST-WINS. Silently keeping one of
    // two numbers someone typed for one rail is the same failure as silently picking between a file
    // and a total: the gate would report on a figure nobody chose.
    const counts = new Map();
    for (const inp of list) counts.set(inp.source, (counts.get(inp.source) || 0) + 1);
    const repeated = [...counts.keys()].filter((s) => counts.get(s) > 1).sort(cmp);
    if (repeated.length > 0) {
      refusedKeys.add(key);
      blockers.push({
        kind: BLOCKER.INPUT_DUPLICATE_SOURCE,
        rail,
        ...moneyOf(rail),
        sources: repeated,
        totals_minor: list.filter((i) => repeated.includes(i.source)).map((i) => i.total_minor),
      });
      continue;
    }

    const file = list.find((i) => i.source === "file");
    const total = list.find((i) => i.source === "total");
    if (file !== undefined && total !== undefined) {
      // BOTH PATHS FOR ONE RAIL, DISAGREEING, IS ITSELF A REFUSAL (ADR-1015). Picking either one
      // would close the month on a number the other input says is wrong, and the operator would
      // never learn which of the two they got.
      if (file.total_minor !== total.total_minor) {
        refusedKeys.add(key);
        blockers.push({
          kind: BLOCKER.INPUT_CONFLICT,
          rail,
          ...moneyOf(rail),
          file_minor: file.total_minor,
          total_minor: total.total_minor,
          difference_minor: Math.abs(file.total_minor - total.total_minor),
          file_sha: file.input_sha,
          total_sha: total.input_sha,
        });
        continue;
      }
      // THEY AGREE, SO THE CLOSE RECORDS THE FILE. Both numbers are the same, so the choice is
      // purely about which receipt the `month.closed` carries -- and the file is the stronger
      // evidence: it is a document whose bytes are pinned by `input_sha`, where the typed total is
      // a number a human retyped from one. Recording the weaker of two equal receipts would throw
      // away the only one that can be re-verified later.
      resolved.set(key, file);
      continue;
    }
    resolved.set(key, file !== undefined ? file : total);
  }

  // ---- pair the two sides ---------------------------------------------------------------------
  const rows = [];

  for (const [key, r] of spineByKey) {
    const input = resolved.get(key);
    const rail = { provider: r.provider, currency: r.currency };
    const base = {
      provider: r.provider,
      currency: r.currency,
      gross_minor: r.gross_minor,
      refund_minor: r.refund_minor,
      net_minor: r.net_minor,
      spine_minor: r.spine_minor, // === net_minor; the receipt's name for the compared figure
      charge_count: r.charge_count,
      refund_count: r.refund_count,
      unlinked_refund_minor: r.unlinked_refund_minor,
    };

    // NET BELOW ZERO IS ITS OWN DIAGNOSIS, checked before anything is compared. It is a fact about
    // the spine side alone -- the month's linked refunds exceed its charges on this rail -- and no
    // input can ever match it, because a provider total is non-negative by construction. Reported
    // as a SHORTFALL it would read as "go find the missing payments", which is the plausible story
    // ADR-1005 warns about instead of the real one. `assertMonthClosed` also refuses a negative
    // `spine_minor`, so this is the branch that stops the gate building a payload the validator
    // would reject.
    if (r.net_minor < 0) {
      rows.push({
        ...base,
        provider_minor: input === undefined ? null : input.total_minor,
        source: input === undefined ? null : input.source,
        input_sha: input === undefined ? null : input.input_sha,
        status: RAIL_STATUS.NET_NEGATIVE,
      });
      blockers.push({
        kind: BLOCKER.NET_NEGATIVE,
        rail,
        ...moneyOf(rail),
        provider_minor: input === undefined ? null : input.total_minor,
        charge_count: r.charge_count,
        refund_count: r.refund_count,
        refund_payment_ids: r.refund_payment_ids.slice(),
      });
      continue;
    }

    if (input === undefined) {
      // Its input was supplied and refused above; it already carries a blocker naming why, and a
      // second NO-INPUT on top would report one problem as two.
      if (refusedKeys.has(key)) {
        rows.push({ ...base, provider_minor: null, source: null, input_sha: null, status: RAIL_STATUS.UNRESOLVED_INPUT });
        continue;
      }
      // NULL, NEVER 0 -- see the header. A rail that settled nothing sums to 0 on the spine too, so
      // an absent input defaulted to 0 would compare EQUAL and close green having checked nothing.
      rows.push({ ...base, provider_minor: null, source: null, input_sha: null, status: RAIL_STATUS.NO_INPUT });
      blockers.push({
        kind: BLOCKER.NO_INPUT,
        rail,
        ...moneyOf(rail),
        // NULL, NEVER 0, on the blocker as well as the row. Netting changed what `net_minor` holds
        // and must not be allowed to reintroduce a defaulted zero here: a rail whose charges and
        // refunds cancel nets to 0, and a 0 in this field would make it read as a matched zero.
        provider_minor: null,
        charge_count: r.charge_count,
        refund_count: r.refund_count,
        unlinked_refund_minor: r.unlinked_refund_minor,
      });
      continue;
    }

    const row = {
      ...base,
      provider_minor: input.total_minor,
      source: input.source,
      input_sha: input.input_sha,
      status: RAIL_STATUS.MATCHED,
    };

    if (r.net_minor < input.total_minor) {
      row.status = RAIL_STATUS.SHORTFALL;
      blockers.push({
        kind: BLOCKER.SHORTFALL,
        rail,
        ...moneyOf(rail),
        provider_minor: input.total_minor,
        gap_minor: input.total_minor - r.net_minor,
        source: input.source,
        charge_count: r.charge_count,
        refund_count: r.refund_count,
        // A gap equal to `refund_minor` says the provider reported GROSS rather than net -- the
        // convention nobody in this lane has been able to verify (FIRED assumption, see header).
        // A gap equal to `unlinked_refund_minor` says a refund on this rail did not link, which is
        // a needs-you item in `arc pnl` rather than a missing payment.
        unlinked_refund_minor: r.unlinked_refund_minor,
        // MISSING-PAYMENT CANDIDATES cannot be listed, because the missing ones are by definition
        // not on this spine. What CAN be listed is every id the spine does hold for this rail and
        // month, which is precisely the left-hand side of the diff against the provider export
        // that finds them.
        recorded_payment_ids: r.charge_payment_ids.slice(),
      });
    } else if (r.net_minor > input.total_minor) {
      row.status = RAIL_STATUS.EXCESS;
      blockers.push({
        kind: BLOCKER.EXCESS,
        rail,
        ...moneyOf(rail),
        provider_minor: input.total_minor,
        gap_minor: r.net_minor - input.total_minor,
        source: input.source,
        charge_count: r.charge_count,
        refund_count: r.refund_count,
        unlinked_refund_minor: r.unlinked_refund_minor,
        // DUPLICATE SUSPECTS: ids recorded more than once for this rail IN THIS MONTH. An empty
        // list is informative rather than reassuring -- it says the excess is not a repeated id,
        // so the next place to look is a payment recorded in the wrong month. A duplicate
        // STRADDLING two months is ADR-1010's render-time flag and stays there; re-deriving it
        // here would be a second spelling of a rule that already has one.
        duplicate_suspects: duplicateSuspects(r.charge_payment_ids),
      });
    }
    rows.push(row);
  }

  // AN INPUT NAMING A RAIL THIS SPINE HAS NEVER HEARD OF blocks too: the provider says it settled
  // money for an account with no payments on the log at all, which is a whole rail of missing
  // ingest rather than a discrepancy within one.
  for (const [key, input] of resolved) {
    if (spineByKey.has(key)) continue;
    // NULL ACROSS ALL FOUR SPINE FIGURES, not 0. No rail at all is not a rail that settled nothing,
    // and a zero here would let this row read as "matched against a provider total of zero".
    rows.push({
      provider: input.provider,
      currency: input.currency,
      gross_minor: null,
      refund_minor: null,
      net_minor: null,
      spine_minor: null,
      charge_count: 0,
      refund_count: 0,
      unlinked_refund_minor: null,
      provider_minor: input.total_minor,
      source: input.source,
      input_sha: input.input_sha,
      status: RAIL_STATUS.NO_SPINE_RAIL,
    });
    blockers.push({
      kind: BLOCKER.NO_SPINE_RAIL,
      rail: { provider: input.provider, currency: input.currency },
      gross_minor: null,
      refund_minor: null,
      net_minor: null,
      provider_minor: input.total_minor,
      source: input.source,
    });
  }

  // NOTHING TO RECONCILE IS NOT A GREEN GATE. `assertMonthClosed` refuses an empty `rails` array
  // for the same reason -- a close that checked nothing renders identically to one that checked
  // everything -- and the gate must never hand the emitter a payload the validator will refuse.
  if (rows.length === 0)
    blockers.push({ kind: BLOCKER.NO_RAILS, rail: null, gross_minor: null, refund_minor: null, net_minor: null });

  // Deterministic by (provider, currency, kind), code-unit. Blockers with no nameable rail sort
  // first on the empty key. Array.prototype.sort has been required to be stable since ES2019, so
  // two blockers sharing all three keys keep their (deterministic) insertion order.
  const sortRail = (b) => (b.rail === null || b.rail === undefined ? { provider: "", currency: "" } : b.rail);
  blockers.sort((a, b) => byRail(sortRail(a), sortRail(b)) || cmp(a.kind, b.kind));
  rows.sort(byRail);

  const ok = blockers.length === 0;
  // THE GREEN PATH CHECKS ITSELF. `ok` claims every rail matched, and this asserts the rows say so
  // too. It runs on every green gate rather than on a test fixture, so it cannot pass vacuously: if
  // the two ever disagree the bug is in this function, and the failure mode of that bug is exactly
  // the silent close everything above exists to prevent.
  if (ok && (rows.length === 0 || rows.some((r) => r.status !== RAIL_STATUS.MATCHED)))
    throw new SpineError("BAD_RECONCILE",
      "internal: reconcile found no blockers while a rail is not MATCHED -- refusing to report a green gate it cannot justify");

  return { ok, rails: rows, blockers };
}

// Ids appearing more than once, with their counts, sorted. Reads a pre-sorted list but does not
// assume it: a Map count is O(n) either way and is not fooled by an unsorted caller.
function duplicateSuspects(ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.keys()]
    .filter((id) => counts.get(id) > 1)
    .sort(cmp)
    .map((id) => ({ provider_payment_id: id, count: counts.get(id) }));
}

// ---------------------------------------------------------------------------------------------
// THE RECEIPT
/**
 * Build the `month.closed` payload for a GREEN gate.
 *
 * Field for field what `assertMonthClosed` (validate-ledger.mjs) accepts, and nothing else: the
 * shape there is CLOSED to {month, rails, payment_count} and each rail to
 * {provider, currency, spine_minor, provider_minor, source, input_sha}. That validator also
 * requires `spine_minor === provider_minor` on EVERY rail -- a condition only a green gate can
 * satisfy -- so this function refuses to build a payload from anything else rather than letting
 * the refusal surface at emit time as a rejected receipt.
 *
 * The caller still owes the emit its `idem`: `sha256("month.closed|" + month)`, welded so a month
 * closes exactly once. That belongs to the emitter, not here -- this module emits nothing.
 */
export function closePayload({ month, rails, paymentCount }) {
  assertMonth(month);
  if (!Number.isSafeInteger(paymentCount) || paymentCount < 0)
    throw new SpineError("BAD_MONTH_CLOSE", `payment_count ${q(paymentCount)} must be a non-negative integer`);
  if (!Array.isArray(rails) || rails.length === 0)
    throw new SpineError("BAD_MONTH_CLOSE", "a close reconciling zero rails is a close that checked nothing");

  const seen = new Set();
  const out = rails.map((r) => {
    if (!isPlainObject(r)) throw new SpineError("BAD_MONTH_CLOSE", "each rail must be an object");
    // A row that did not MATCH may not be written. `status` is optional so a caller can hand in a
    // bare rail shape, but if it is present it must say MATCHED -- a receipt built from a row the
    // gate refused is a permanent record asserting a reconciliation that did not happen.
    if ("status" in r && r.status !== RAIL_STATUS.MATCHED)
      throw new SpineError("BAD_MONTH_CLOSE",
        `rail ${r.provider}/${r.currency} has status ${q(r.status)} -- a close is only ever written behind a GREEN gate`);
    if (typeof r.provider !== "string" || !PROVIDER_RE.test(r.provider))
      throw new SpineError("BAD_MONTH_CLOSE", `rail provider ${q(r.provider)} must be a lowercase slug`);
    if (typeof r.currency !== "string" || !CURRENCY_RE.test(r.currency))
      throw new SpineError("BAD_MONTH_CLOSE", `rail currency ${q(r.currency)} must be an ISO-4217 alpha code`);
    for (const k of ["spine_minor", "provider_minor"]) {
      const v = r[k];
      // Zero is legal, negative is not, and null is not: an unreconciled rail has no
      // `provider_minor`, and coercing that null to 0 here would rebuild the very equality the
      // gate refused to grant it.
      if (!Number.isSafeInteger(v) || v < 0 || v > MAX_MINOR_UNITS)
        throw new SpineError("BAD_MONTH_CLOSE",
          `rail ${r.provider}/${r.currency} ${k} ${q(v)} must be a non-negative integer in minor units`);
    }
    if (r.spine_minor !== r.provider_minor)
      throw new SpineError("BAD_MONTH_CLOSE",
        `rail ${r.provider}/${r.currency} has spine_minor ${r.spine_minor} against provider_minor ${r.provider_minor} -- the validator refuses this receipt and so does the gate that would have written it`);
    if (!SOURCES.includes(r.source))
      throw new SpineError("BAD_MONTH_CLOSE", `rail ${r.provider}/${r.currency} source ${q(r.source)} is outside ${SOURCES.join("|")}`);
    if (typeof r.input_sha !== "string" || !HEX64_RE.test(r.input_sha))
      throw new SpineError("BAD_MONTH_CLOSE", `rail ${r.provider}/${r.currency} input_sha must be a lowercase sha256 of the reconciliation input`);
    const key = railKey(r);
    if (seen.has(key))
      throw new SpineError("BAD_MONTH_CLOSE", `rails names ${key} twice -- a rail reconciles once`);
    seen.add(key);
    // Key order is the validator's RAIL_KEYS order. The canonicalizer sorts keys before hashing, so
    // this is for the reader of the JSONL rather than for the sha.
    return {
      provider: r.provider,
      currency: r.currency,
      spine_minor: r.spine_minor,
      provider_minor: r.provider_minor,
      source: r.source,
      input_sha: r.input_sha,
    };
  });

  out.sort(byRail);
  return { month, rails: out, payment_count: paymentCount };
}

// ---------------------------------------------------------------------------------------------
// THE INPUT RECEIPT
/**
 * sha256 of a reconciliation input.
 *
 * A FILE is hashed over its RAW BYTES, so pass the Buffer that `readFileSync` returned and not a
 * utf8 string of it. Decoding first is lossy in exactly the case that matters: an invalid byte
 * sequence becomes U+FFFD, so two different export files can decode to one string and hash the
 * same -- and the sha exists precisely to prove which bytes produced the number.
 *
 * A TYPED TOTAL is hashed over its canonical decimal string (`canonicalTotalText`). It pins the
 * only thing a typed total has: the digits the operator typed.
 */
export function inputSha(text) {
  if (typeof text === "string") return sha256Hex(text);
  if (text instanceof Uint8Array) return createHash("sha256").update(text).digest("hex");
  throw new SpineError("BAD_RECONCILE",
    "inputSha takes the file's raw bytes (a Buffer/Uint8Array) or the canonical decimal string of a typed total");
}

/**
 * ONE spelling of "the canonical decimal string of a typed total", so the sha in the receipt and
 * the sha anyone recomputes from the receipt are computed the same way. Plain digits: no sign, no
 * separators, no decimal point, no exponent. The MAX bound is what keeps the exponent impossible --
 * `String(n)` only reaches exponent notation at 1e21, far above any settlement this lane accepts.
 */
export function canonicalTotalText(totalMinor) {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || totalMinor > MAX_MINOR_UNITS)
    throw new SpineError("BAD_RECONCILE",
      `a typed total ${q(totalMinor)} must be a non-negative integer count of minor units, at most ${MAX_MINOR_UNITS} (ADR-1012)`);
  return String(totalMinor);
}
