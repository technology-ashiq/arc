// pnl.mjs — the derivation. Every number `arc pnl` prints is computed here, from spine events, at
// render time (ADR-1000 / LED-A). Nothing is cached, nothing is stored, and no event is ever
// emitted from event data.
//
// Two structural properties this module must never lose:
//
//   REAL AND SIMULATED NEVER CO-RENDER, and not because a filter drops one at the end. The mode
//   selects exactly ONE kind at the top and the other is never read. A filter applied late is a
//   filter that a future edit can forget; selecting the input is a property of the shape.
//
//   MONTH BUCKETING IS EXACT. Every `ts` on this spine matches IST_TS_RE, which REQUIRES the
//   +05:30 offset (canonical.mjs) -- a non-IST timestamp is refused at ingest and cannot reach
//   here. So `ts.slice(0, 7)` is the IST month, with no conversion and no zone library. The real
//   timezone hazard in this lane lives one layer out, where a provider export's UTC settlement
//   time is converted before it becomes an event, and that is the normalizer's fixture to carry.
//
// EVERYTHING IS REPORTED IN INR. Amounts arrive in their own currency and are converted at the
// rate recorded on their own event. An earlier version converted the revenue rows and left MRR in
// the charge's native minor units while rendering it as rupees -- so a $50/month subscription
// showed as "MRR 50.00" instead of 4,160.00, understating by the exchange rate, and a venture with
// one rupee sub and one dollar sub summed raw minor units across two currencies.

import { query } from "../../spine.mjs";
import { convertMinorUnits, isSupportedCurrency } from "./money.mjs";

const REAL_KIND = "revenue.received";
const SIMULATED_KIND = "revenue.simulated";
const REPORTING_CURRENCY = "INR";
const OVERHEAD_VENTURE = "arc";
const COMPONENTS = ["gross", "fees", "tax", "net"];

// The divisor is ALSO the number of months a single charge keeps the subscription alive, which is
// why one constant serves both jobs: an annual charge is a twelfth of MRR each month AND covers
// twelve months. Treating a yearly payer as churned in month two -- which a monthly-shaped
// "charged recently?" test does -- would wipe most of the MRR of a business selling annual plans.
// Division is integer with the remainder dropped: it understates by at most one paise per plan per
// month and never overstates, and a P&L that rounds recurring revenue UP is the one direction that
// flatters.
const INTERVAL_DIVISOR = Object.freeze({ monthly: 1, quarterly: 3, annual: 12, one_time: null });

const monthOf = (ts) => ts.slice(0, 7);

// Convert an amount on an event to reporting currency using THAT EVENT's own recorded rate. Zero
// lookups, ever (ADR-1003) -- the rate is a receipt, not a variable.
const toReporting = (value, p) =>
  convertMinorUnits({ amount: value, from: p.currency, to: REPORTING_CURRENCY, rate: p.fx ? p.fx.rate : "1.0" });

// Flags carry the venture they belong to so `--venture X` cannot report X a problem that belongs
// to Y. Flag text names payment ids and never ventures, so without this the operator has no way to
// tell whose problem they are reading.
function needsYou(list, type, venture, detail) {
  list.push({ type, venture, detail });
}

// The subscription identity is `venture` + `customer_ref`, deliberately WITHOUT `plan`: a plan
// change is exactly what expansion and contraction mean, so including it would make every upgrade
// look like one subscription churning and another being born.
function subscriptionKey(p) {
  return `${p.venture}\u0000${p.customer_ref}`;
}

export async function derivePnl(root, { mode = "real", venture = null, month = null, engine } = {}) {
  const kind = mode === "simulated" ? SIMULATED_KIND : REAL_KIND;
  const res = await query(root, { engine });
  // The reader yields RECORDS -- {event, day, seq, line} -- not bare events.
  const all = res.events.map((r) => r.event);

  // ONE kind. The other is not read, not filtered, not seen.
  const revenue = all.filter((e) => e.kind === kind);
  const costs = all.filter((e) => e.kind === "cost.incurred");

  const flags = [];

  // ---- natural-key duplicates (ADR-1010 / LED-K) ----------------------------------------------
  const byPaymentId = new Map();
  for (const e of revenue) {
    const id = e.payload.provider_payment_id;
    if (!byPaymentId.has(id)) byPaymentId.set(id, []);
    byPaymentId.get(id).push(e);
  }
  const excluded = new Set();
  const excludedPaymentIds = new Set();
  for (const [id, group] of byPaymentId) {
    if (group.length > 1) {
      excludedPaymentIds.add(id);
      for (const e of group) excluded.add(e.id);
      needsYou(flags, "DUPLICATE_PAYMENT", group[0].payload.venture,
        `${id} appears on ${group.length} events (${group.map((e) => e.id).join(", ")}). ` +
        "All are excluded from totals pending your decision -- keeping the first would be correct by luck.");
    }
  }

  // ---- refunds link to their charge (ADR-1016 / LED-Q) -----------------------------------------
  const charges = [];
  const refunds = [];
  for (const e of revenue) {
    if (excluded.has(e.id)) continue;
    if ("refund_of" in e.payload) refunds.push(e); else charges.push(e);
  }
  const chargeById = new Map(charges.map((e) => [e.payload.provider_payment_id, e]));
  const refundIds = new Set(refunds.map((e) => e.payload.provider_payment_id));

  const refundedByCharge = new Map();
  const linkedRefunds = new Set();
  // THE LINKAGE, PUBLISHED AS A FACT (additive, for the month-close gate -- ADR-1005 / LED-F).
  //
  // Five rules decide whether a refund links: its charge is on the spine, that charge is not itself
  // a refund, same venture, same currency, and it is not dated before its charge. They are applied
  // exactly ONCE -- here -- and `reconcile.mjs` reads this list instead of re-deriving them. A
  // second copy of five rules is a second thing to keep in step, which is the twin-fix defect this
  // lane has already paid for twice.
  //
  // UNFILTERED BY MONTH AND VENTURE ON PURPOSE. This is the linkage itself, not a view of it; every
  // filtering decision belongs to the consumer, and the close buckets a refund by the month it was
  // RECORDED in (ADR-1004: a closed month never restates) rather than by its charge's month.
  const refundLinks = [];
  for (const r of refunds) {
    const target = r.payload.refund_of;
    const charge = chargeById.get(target);
    if (!charge) {
      // Three DIFFERENT situations, told apart. Reporting all of them as "not on the spine" sent
      // the operator hunting for a missing import that did not exist.
      if (excludedPaymentIds.has(target))
        needsYou(flags, "REFUND_OF_EXCLUDED_CHARGE", r.payload.venture,
          `refund ${r.payload.provider_payment_id} names charge ${target}, which IS on the spine but is excluded as a duplicate. Resolve the duplicate and this resolves with it.`);
      else if (refundIds.has(target))
        needsYou(flags, "REFUND_OF_REFUND", r.payload.venture,
          `refund ${r.payload.provider_payment_id} names ${target}, which is itself a refund. A refund refunds a CHARGE.`);
      else
        needsYou(flags, "REFUND_WITHOUT_CHARGE", r.payload.venture,
          `refund ${r.payload.provider_payment_id} names charge ${target}, which is not on the spine. ` +
          "A refund of a payment we never recorded means the ingest is incomplete -- it is not netted away.");
      continue;
    }
    // A refund belongs to the venture of the CHARGE it refunds. Booking it against whatever the
    // refund itself declares made two per-venture P&Ls wrong in opposite directions while the
    // company total netted to zero, which is exactly how it stays invisible.
    if (r.payload.venture !== charge.payload.venture) {
      needsYou(flags, "REFUND_VENTURE_MISMATCH", charge.payload.venture,
        `refund ${r.payload.provider_payment_id} declares venture ${r.payload.venture} but charge ${target} belongs to ${charge.payload.venture}. It is not applied to either.`);
      continue;
    }
    // Compared in the ORIGINAL CHARGE CURRENCY, before any conversion, so rate movement between a
    // charge and its refund can neither fire nor suppress the over-refund flag.
    if (r.payload.currency !== charge.payload.currency) {
      needsYou(flags, "REFUND_CURRENCY_MISMATCH", charge.payload.venture,
        `refund ${r.payload.provider_payment_id} is in ${r.payload.currency} but charge ${target} is in ${charge.payload.currency}. ` +
        "Comparing across a conversion would make the over-refund test a function of the exchange rate.");
      continue;
    }
    if (r.ts < charge.ts) {
      needsYou(flags, "REFUND_BEFORE_CHARGE", charge.payload.venture,
        `refund ${r.payload.provider_payment_id} is recorded at ${r.ts}, before its charge ${target} at ${charge.ts}. Money cannot be returned before it arrives, so one of the two timestamps is wrong.`);
      continue;
    }
    linkedRefunds.add(r.id);
    // `amount` stays the POSITIVE magnitude refunded, exactly as recorded (ADR-1016 / LED-Q). The
    // render negates it for its own row; a consumer doing arithmetic wants the number the spine
    // carries, not the sign one view chose. `venture` is the CHARGE's venture, which is the one a
    // refund belongs to.
    refundLinks.push({
      id: r.id,
      ts: r.ts,
      provider: r.payload.provider,
      currency: r.payload.currency,
      amount: r.payload.amount,
      paymentId: r.payload.provider_payment_id,
      refundOf: target,
      venture: charge.payload.venture,
    });
    const prior = refundedByCharge.get(target) || { total: 0, events: [] };
    prior.total += r.payload.amount;
    prior.events.push(r);
    refundedByCharge.set(target, prior);
  }
  for (const [target, agg] of refundedByCharge) {
    const charge = chargeById.get(target);
    if (agg.total > charge.payload.amount)
      needsYou(flags, "OVER_REFUND", charge.payload.venture,
        `charge ${target} is ${charge.payload.amount} ${charge.payload.currency} but ${agg.total} has been refunded against it. ` +
        "Never silently netted: this is either a data error or something that needs you, and both deserve you.");
  }

  // ---- per-venture accumulation ----------------------------------------------------------------
  const ventures = new Map();
  const bucket = (v) => {
    if (!ventures.has(v))
      ventures.set(v, { venture: v, gross: null, fees: null, tax: null, net: null, cashIn: 0, mrr: 0, rows: [], costs: [] });
    return ventures.get(v);
  };

  const inMonth = (e) => month === null || monthOf(e.ts) === month;
  const inVenture = (v) => venture === null || v === venture;

  for (const e of charges) {
    if (!inMonth(e) || !inVenture(e.payload.venture)) continue;
    const p = e.payload;
    if (!isSupportedCurrency(p.currency)) {
      needsYou(flags, "UNSUPPORTED_CURRENCY", p.venture,
        `${p.provider_payment_id} is in ${p.currency}, which has no pinned minor-unit exponent (ADR-1013). It is excluded rather than guessed.`);
      continue;
    }
    const b = bucket(p.venture);
    // ABSENT STAYS ABSENT. A component nobody recorded contributes nothing and renders absent; it
    // is never coerced to 0, because an unknown fee and a waived fee are different facts.
    for (const k of COMPONENTS) {
      if (!(k in p)) continue;
      b[k] = (b[k] === null ? 0 : b[k]) + toReporting(p[k], p);
    }
    const amountInr = toReporting(p.amount, p);
    b.cashIn += amountInr;
    b.rows.push({
      id: e.id, ts: e.ts, paymentId: p.provider_payment_id,
      amount: p.amount, currency: p.currency, amountInr,
      gross: p.gross, fees: p.fees, tax: p.tax, net: p.net,
      plan: p.plan, interval: p.interval, fx: p.fx || null,
    });
  }

  // Refunds reduce cash-in in the month they were RECORDED, never the month of their charge
  // (ADR-1004: a closed month never restates). Only refunds that actually LINKED are applied --
  // an unlinked one is a needs-you item above and its money is not silently subtracted.
  for (const r of refunds) {
    if (!linkedRefunds.has(r.id)) continue;
    if (!inMonth(r)) continue;
    const p = r.payload;
    const chargeVenture = chargeById.get(p.refund_of).payload.venture;
    if (!inVenture(chargeVenture)) continue;
    if (!isSupportedCurrency(p.currency)) continue;
    const b = bucket(chargeVenture);
    const inr = toReporting(p.amount, p);
    b.cashIn -= inr;
    b.rows.push({
      id: r.id, ts: r.ts, paymentId: p.provider_payment_id, refundOf: p.refund_of,
      amount: -p.amount, currency: p.currency, amountInr: -inr,
      gross: undefined, fees: undefined, tax: undefined, net: undefined,
      plan: p.plan, interval: p.interval, fx: p.fx || null,
    });
  }

  const mrr = deriveMrr(charges, { month, venture, refundedByCharge });
  for (const [v, m] of mrr.byVenture) if (inVenture(v)) bucket(v).mrr = m;

  // ---- costs: `venture: arc` is Overhead and is never attributed to a product --------------------
  const overhead = { venture: OVERHEAD_VENTURE, lines: [] };
  for (const e of costs) {
    if (!inMonth(e)) continue;
    const isOverhead = e.venture === OVERHEAD_VENTURE;
    // The venture filter applies to costs too. Without it, `--venture kappa` created and rendered
    // `lambda` from a cost event -- a venture the operator did not ask for, showing no revenue and
    // no explanation.
    if (!isOverhead && !inVenture(e.venture)) continue;
    const p = e.payload;
    const amount = typeof p.amount === "number" && Number.isSafeInteger(p.amount) ? p.amount : null;
    const currency = typeof p.currency === "string" ? p.currency : null;
    // A cost in an unpinned currency is EXCLUDED WITH A FLAG, never allowed to throw. One
    // `cost.incurred` in an unsupported currency used to abort the whole command, and because the
    // spine is append-only the operator could not delete it -- the P&L was unreadable until
    // someone shipped a code change.
    if (currency !== null && !isSupportedCurrency(currency)) {
      needsYou(flags, "UNSUPPORTED_COST_CURRENCY", e.venture,
        `a cost on ${e.ts} is in ${currency}, which has no pinned minor-unit exponent (ADR-1013). It is excluded from the render rather than guessed, and the rest of the P&L still renders.`);
      continue;
    }
    if (amount === null && p.amount !== undefined)
      needsYou(flags, "COST_NOT_MINOR_UNITS", e.venture,
        `a cost on ${e.ts} carries amount ${JSON.stringify(p.amount)}, which is not an integer count of minor units (ADR-1012). It renders absent rather than as a number nobody can trust.`);
    const line = { id: e.id, ts: e.ts, source: p.source || null, amount, currency, label: p.label || null };
    if (isOverhead) overhead.lines.push(line); else bucket(e.venture).costs.push(line);
  }

  const scopedFlags = venture === null ? flags : flags.filter((f) => f.venture === venture);

  return {
    engine: res.engine,
    mode,
    month,
    ventureFilter: venture,
    ventures: [...ventures.values()].sort((a, b) => (a.venture < b.venture ? -1 : a.venture > b.venture ? 1 : 0)),
    overhead,
    mrr,
    needsYou: scopedFlags,
    counts: { revenue: revenue.length, charges: charges.length, refunds: refunds.length, costs: costs.length },
    // Read by reconcile.mjs and by nothing that renders. Additive: no existing field moved, no
    // existing number re-derived, and the P&L text is byte-identical with and without it.
    refundLinks,
  };
}

// Transitions are computed over the whole history, then reported for the requested month: a
// reactivation is only visible if you can see the gap before it, and a churn only from the absence
// that follows.
export function deriveMrr(charges, { month = null, venture = null, refundedByCharge = new Map() } = {}) {
  const subs = new Map();
  let latestMonth = null;
  for (const e of charges) {
    const p = e.payload;
    if (!isSupportedCurrency(p.currency)) continue;
    const m = monthOf(e.ts);
    if (latestMonth === null || m > latestMonth) latestMonth = m;
    if (!("customer_ref" in p)) continue;         // no identity, no subscription: cash only
    if (p.interval === undefined) continue;       // an unlabelled payment is not asserted recurring
    // OWN-PROPERTY ONLY. `INTERVAL_DIVISOR["constructor"]` returns Object off the prototype chain,
    // which is neither null nor undefined, so the guard below did not fire and the MRR became NaN.
    // Unreachable today because `INTERVALS` refuses those spellings at ingest -- which means this
    // is a defect one validator change away from being live, in a lane where the same class was
    // already fixed in kill-distance.mjs and costs.mjs. Fixed where it is, not where it was found.
    const divisor = Object.prototype.hasOwnProperty.call(INTERVAL_DIVISOR, p.interval)
      ? INTERVAL_DIVISOR[p.interval] : undefined;
    if (divisor === null || divisor === undefined) continue;  // one_time is cash, never MRR

    // A charge refunded in full is not recurring revenue. The refund total was collected here and
    // then never read, so a subscription charged in July and fully refunded in August still
    // reported its MRR for July.
    const refunded = (refundedByCharge.get(p.provider_payment_id) || { total: 0 }).total;
    if (refunded >= p.amount) continue;

    // MRR base is the recurring amount EX-TAX (ADR-1007), CONVERTED to reporting currency.
    const monthly = Math.floor(toReporting(p.amount - refunded, p) / divisor);
    const key = subscriptionKey(p);
    if (!subs.has(key)) subs.set(key, { venture: p.venture, points: [] });
    subs.get(key).points.push({ month: m, id: e.id, monthly, covers: divisor });
  }

  // The reference month for "current MRR". With no --month the answer used to be "every
  // subscription that ever existed", because the lapse check was short-circuited for the all-time
  // view -- one charge in January reported full MRR in August. The latest month in the DATA is
  // used instead of a wall clock, so the answer is replay-stable.
  const asOfMonth = month !== null ? month : latestMonth;

  const transitions = [];
  const byVenture = new Map();
  for (const [, sub] of subs) {
    if (venture !== null && sub.venture !== venture) continue;
    // TOTAL order: month, then event id. Sorting on month alone ties for two charges in one month,
    // and the winner was then whichever the reader happened to return last -- so the same data
    // produced a different MRR depending on ingest order.
    const points = sub.points.slice().sort((a, b) =>
      a.month < b.month ? -1 : a.month > b.month ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

    let previous = null, previousMonth = null, previousCovers = 1;
    for (const pt of points) {
      let type;
      if (previous === null) type = "new";
      else if (previousMonth !== null && monthsBetween(previousMonth, pt.month) > previousCovers) type = "reactivation";
      else if (pt.monthly > previous) type = "expansion";
      else if (pt.monthly < previous) type = "contraction";
      else type = "renewal";
      if (month === null || pt.month === month)
        transitions.push({ venture: sub.venture, month: pt.month, id: pt.id, type, from: previous, to: pt.monthly });
      previous = pt.monthly;
      previousMonth = pt.month;
      previousCovers = pt.covers;
    }

    const last = points[points.length - 1];
    if (month !== null && last && last.month < month && monthsBetween(last.month, month) >= last.covers)
      transitions.push({ venture: sub.venture, month, id: last.id, type: "churn", from: last.monthly, to: 0 });

    // MRR AS OF the reference month: the latest charge at or before it whose coverage has not
    // lapsed. Applied for the all-time view too, which is where it was missing.
    const asOf = asOfMonth === null ? null : points.filter((p) => p.month <= asOfMonth).slice(-1)[0];
    if (asOf && monthsBetween(asOf.month, asOfMonth) < asOf.covers)
      byVenture.set(sub.venture, (byVenture.get(sub.venture) || 0) + asOf.monthly);
  }
  return { byVenture, transitions, asOfMonth };
}

// Calendar months between two YYYY-MM strings, in absolute month ordinals so a year boundary is not
// a special case: 2026-12 to 2027-01 is 1, which a naive month-number subtraction reports as -11.
function monthsBetween(earlier, later) {
  const [ey, em] = earlier.split("-").map(Number);
  const [ly, lm] = later.split("-").map(Number);
  return (ly * 12 + lm) - (ey * 12 + em);
}
