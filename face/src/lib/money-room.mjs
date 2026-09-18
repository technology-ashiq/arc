// money-room.mjs -- what the money and ventures rooms fold the same way (face v2 Phase 03, money ring,
// ADR-1320, ADR-1324).
//
// Both rooms read the same three door routes -- /api/health for the kinds that have ever fired, /api/pnl
// for the real P&L and the kill panel, /api/pnl?simulated=1 for the simulated one -- and every honesty rule
// about money already lives in money.mjs, where the Cycle 15 renderers put it. This file is the half that
// used to live inside MoneyRoom.tsx and VenturesRoom.tsx: which reads to make, what each answer is, and the
// view each panel draws, decided where node can reach it. The two rooms' Views draw these and decide nothing.
//
// The ring's rules, applied here as in lane-room.mjs:
//   - a read is made only if the manifest the host hands the fold allows it -- by registry.readProblem, the
//     host's own rule -- and a fold handed no manifest reads nothing;
//   - a 200 that is not the thing asked for is a REFUSAL with a code: the simulated read answering with a
//     real body, or the real read with a simulated one, is WRONG_SUBSTANCE, never a second "real revenue"
//     panel drawn under the simulated heading;
//   - nothing is summed that the door did not sum: costs are counted by currency, never totalled, and the
//     return is refused by name (money.mjs, costTally and returnStatement).
import { payloadOf, readProblem } from "./registry.mjs";
import { readHealth } from "./inbox.mjs";
import {
  REAL_KIND, SIM_KIND, criterionSentence, fmtInt, formatMinor, greenGate, killSummary, readKill, readPnl,
  revenuePanel, rupees,
} from "./money.mjs";

/** The three reads both rooms make. */
export const HEALTH_READ = Object.freeze({ route: "/api/health" });
export const REAL_READ = Object.freeze({ route: "/api/pnl" });
export const SIM_READ = Object.freeze({ route: "/api/pnl", query: Object.freeze({ simulated: "1" }) });

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/**
 * @typedef {import("./registry.mjs").Payload} Payload
 * @typedef {import("./registry.mjs").Read} Read
 * @typedef {import("./registry.mjs").FoldContext} FoldContext
 * @typedef {import("./money.mjs").PnlView} PnlView
 * @typedef {import("./money.mjs").KillView} KillView
 * @typedef {import("./money.mjs").GreenGate} GreenGate
 * @typedef {import("./money.mjs").Figure} Figure
 * @typedef {import("./money.mjs").CostTally} CostTally
 * @typedef {import("./money.mjs").RevenuePanel} RevenuePanel
 * @typedef {import("./inbox.mjs").HealthView} HealthView
 *
 * @typedef {{ isReading: boolean, isRefused: boolean, isRead: boolean, refusal: { code: string, human: string } }} ReadState
 *
 * @typedef {object} MoneyReads
 * @property {Read[]} reads
 * @property {ReadState} health
 * @property {ReadState} real
 * @property {ReadState} sim
 * @property {HealthView | null} healthView
 * @property {PnlView | null} realView
 * @property {PnlView | null} simView
 * @property {KillView | null} killView
 * @property {GreenGate} gate
 * @property {boolean} realFired   /api/health lists revenue.received among the kinds that have fired
 * @property {boolean} simFired
 * @property {string} mode         the door's data mode, or "unknown"
 * @property {string} readAt       the door's own clock, when health answered
 */

/** @param {string} code @param {string} human @returns {ReadState} */
const refused = (code, human) => ({ isReading: false, isRefused: true, isRead: false, refusal: { code, human } });

/** @param {Payload} p @returns {ReadState} */
function stateOf(p) {
  if (p.state === "ok") return { isReading: false, isRefused: false, isRead: true, refusal: NO_REFUSAL };
  if (p.state === "refused") return refused(p.code, p.human);
  return { isReading: true, isRefused: false, isRead: false, refusal: NO_REFUSAL };
}

/**
 * The three reads, asked for and answered.
 * @param {Record<string, Payload>} payloads @param {FoldContext} ctx
 * @returns {MoneyReads}
 */
export function moneyReads(payloads, ctx) {
  /** @type {Read[]} */
  const reads = [];
  /** @param {Read} read @returns {Payload} */
  const one = (read) => {
    const why = readProblem(read, ctx.manifest);
    if (why !== null) return { state: "refused", code: "READ_REFUSED", human: why };
    reads.push(read);
    return payloadOf(payloads, read);
  };
  const healthP = one(HEALTH_READ);
  const realP = one(REAL_READ);
  const simP = one(SIM_READ);

  const healthView = healthP.state === "ok" ? readHealth(healthP.data) : null;
  let realState = stateOf(realP);
  let realView = realP.state === "ok" ? readPnl(realP.data) : null;
  let simState = stateOf(simP);
  let simView = simP.state === "ok" ? readPnl(simP.data) : null;
  // A body of the other substance is not the thing asked for. Drawing it would put real money under the
  // simulated heading, or a simulated figure under the real one -- the exact lie this room exists to refuse.
  if (realView !== null && realView.substance !== "real") {
    realState = refused("WRONG_SUBSTANCE", `the real P&L was asked for, and the door answered with a ${realView.substance} body`);
    realView = null;
  }
  if (simView !== null && simView.substance !== "simulated") {
    simState = refused("WRONG_SUBSTANCE", `the simulated P&L was asked for, and the door answered with a ${simView.substance} body`);
    simView = null;
  }
  // The kill panel rides on the REAL body; a body refused above carries no kill panel either.
  const killView = realView === null || realP.state !== "ok" ? null : readKill(realP.data);
  const gate = greenGate({ health: healthView, real: realView });
  const kinds = healthView !== null && Array.isArray(healthView.kinds) ? healthView.kinds : [];
  return {
    reads,
    health: stateOf(healthP),
    real: realState,
    sim: simState,
    healthView,
    realView,
    simView,
    killView,
    gate,
    realFired: kinds.includes(REAL_KIND),
    simFired: kinds.includes(SIM_KIND),
    mode: realView !== null ? realView.doorMode : "unknown",
    readAt: healthView !== null && typeof healthView.now === "string" ? healthView.now : "",
  };
}

/**
 * @typedef {object} RowView
 * @property {string} id
 * @property {string} ts
 * @property {string} amount
 * @property {string} ink
 * @property {string} venture
 * @property {string} payment
 * @property {string} fx
 * @property {boolean} hasFx
 *
 * @typedef {object} SubstanceView
 * @property {string} title
 * @property {string} lede
 * @property {string} kind
 * @property {boolean} isSim        the non-real family: violet AND hatched, the whole region
 * @property {string} watermark
 * @property {boolean} hasWatermark
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {boolean} isDrawn
 * @property {{ code: string, human: string }} refusal
 * @property {string} reading
 * @property {Figure} cashIn
 * @property {Figure} mrr
 * @property {string} scopeNote
 * @property {(Figure & { label: string })[]} components
 * @property {boolean} hasComponents
 * @property {{ venture: string, cashIn: Figure, mrr: Figure }[]} ventures
 * @property {boolean} hasVentures
 * @property {RowView[]} rows
 * @property {boolean} hasRows
 */

/**
 * One substance -- real or simulated -- as its panel draws it. Every row's ink is decided here: simulated
 * rows wear the non-real ink, real rows wear green only through the gate, and nothing else ever does.
 * @param {MoneyReads} m @param {"real" | "simulated"} want
 * @returns {SubstanceView}
 */
export function substanceView(m, want) {
  const isSim = want === "simulated";
  const pnl = isSim ? m.simView : m.realView;
  const state = isSim ? m.sim : m.real;
  /** @type {RevenuePanel} */
  const panel = revenuePanel({ pnl, gate: m.gate, everFired: isSim ? m.simFired : m.realFired, want });
  const ink = isSim ? "var(--sim-fg)" : m.gate.spendable ? "var(--green)" : "var(--faint)";
  /** @type {RowView[]} */
  const rows = [];
  for (const v of panel.ventures) {
    for (const r of v.rows) {
      const inr = r.amountInr === null ? null : rupees(r.amountInr);
      const native = r.amount === null || r.currency === null ? null : formatMinor(Math.abs(r.amount), r.currency);
      const hasFx = native !== null && r.currency !== "INR";
      rows.push({
        id: r.id,
        ts: r.ts,
        amount: inr === null ? "not served" : inr.text,
        ink,
        venture: v.venture,
        payment: r.refundOf === null ? r.paymentId : `refund of ${r.refundOf}`,
        // Converted at the rate recorded ON the event -- never one looked up at render (ADR-1003).
        fx: hasFx && native !== null ? `${native.text} ${r.currency} @ ${r.rate ?? "rate not recorded"}` : "",
        hasFx,
      });
    }
  }
  return {
    title: panel.title,
    lede: panel.lede,
    kind: panel.kind,
    isSim,
    watermark: panel.watermark,
    hasWatermark: panel.watermark !== "",
    isReading: state.isReading,
    isRefused: state.isRefused,
    isDrawn: state.isRead,
    refusal: state.refusal,
    reading: isSim ? "the simulated P&L" : "the real P&L",
    cashIn: panel.cashIn,
    mrr: panel.mrr,
    scopeNote: panel.scopeNote,
    components: panel.components,
    hasComponents: panel.components.length > 0,
    ventures: panel.ventures.map((v) => ({ venture: v.venture, cashIn: v.cashIn, mrr: v.mrr })),
    hasVentures: panel.ventures.length > 0,
    rows,
    hasRows: rows.length > 0,
  };
}

/**
 * @typedef {object} CostView
 * @property {string} title
 * @property {string} lede
 * @property {string} count
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {boolean} isEmpty
 * @property {boolean} isDrawn
 * @property {{ code: string, human: string }} refusal
 * @property {{ key: string, text: string, warn: string, hasWarn: boolean }[]} chips
 * @property {string} rule        why no total is printed -- a rule, not an apology
 * @property {{ id: string, ts: string, amount: string, isExact: boolean, note: string, source: string, label: string }[]} lines
 */

/**
 * Cost lines, counted by currency and by recorded source, and never summed (money.mjs costTally).
 * @param {string} title @param {string} lede @param {CostTally} tally @param {ReadState} state
 * @returns {CostView}
 */
export function costView(title, lede, tally, state) {
  return {
    title,
    lede,
    count: `${fmtInt(tally.lines.length)} line${tally.lines.length === 1 ? "" : "s"}`,
    isReading: state.isReading,
    isRefused: state.isRefused,
    isEmpty: state.isRead && tally.lines.length === 0,
    isDrawn: state.isRead && tally.lines.length > 0,
    refusal: state.refusal,
    chips: [
      ...tally.byCurrency.map((c) => ({
        key: `currency:${c.currency}`,
        text: `${c.currency} · ${fmtInt(c.count)} receipt${c.count === 1 ? "" : "s"}`,
        warn: c.unrenderable === 0 ? "" : ` · ${fmtInt(c.unrenderable)} unrenderable`,
        hasWarn: c.unrenderable > 0,
      })),
      ...tally.bySource.map((s) => ({ key: `source:${s.source}`, text: `source ${s.source} · ${fmtInt(s.count)}`, warn: "", hasWarn: false })),
    ],
    rule: tally.refusal,
    lines: tally.lines.map((l) => {
      const money = l.amount === null || l.currency === null ? null : formatMinor(l.amount, l.currency);
      return {
        id: l.id,
        ts: l.ts,
        amount: money === null ? "—" : money.text,
        isExact: money !== null && money.exact,
        note: money === null ? "the door served no amount for this line" : money.note,
        source: l.source ?? "source unrecorded",
        label: l.label ?? "",
      };
    }),
  };
}

/**
 * @typedef {object} KillLinesView
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {boolean} isPanel
 * @property {boolean} hasNote       the kill panel itself carries a refusal (absent, unreceipted)
 * @property {{ code: string, human: string }} note
 * @property {boolean} isLoud
 * @property {string} summary
 * @property {boolean} isDanger
 * @property {{ key: string, venture: string, criterion: string, headline: string, ink: string, detail: string, isAbsent: boolean }[]} rows
 * @property {string[]} future
 * @property {boolean} hasFuture
 * @property {string} receipt
 * @property {string} receiptTitle
 * @property {string} badge
 * @property {string} asOf
 * @property {boolean} hasAsOf
 */

/**
 * The kill lines, as the panel draws them: its three refusal states, none drawn as an empty panel -- an
 * absent kill panel and a healthy one looking the same is how a disarmed kill switch stays invisible.
 * @param {MoneyReads} m
 * @returns {KillLinesView}
 */
export function killLinesView(m) {
  const kill = m.killView;
  const base = { isReading: m.real.isReading, isRefused: m.real.isRefused, refusal: m.real.refusal };
  if (kill === null) {
    return {
      ...base, isPanel: false, hasNote: false, note: NO_REFUSAL, isLoud: false, summary: "", isDanger: false,
      rows: [], future: [], hasFuture: false, receipt: "", receiptTitle: "", badge: "", asOf: "", hasAsOf: false,
    };
  }
  const summary = killSummary(kill);
  return {
    ...base,
    isPanel: kill.state === "panel",
    hasNote: kill.refusal !== null,
    note: kill.refusal ?? NO_REFUSAL,
    isLoud: kill.state === "unreceipted",
    summary: summary.sentence,
    isDanger: summary.danger,
    rows: kill.state !== "panel" ? [] : kill.ventures.flatMap((v) => v.criteria.map((c) => {
      const said = criterionSentence(c);
      return { key: `${v.venture}:${c.criterion}`, venture: v.venture, criterion: c.criterion, headline: said.headline, ink: said.ink, detail: said.detail, isAbsent: said.state === "absent" };
    })),
    future: kill.futureRevenue.map((f) => `${f.venture} has ${f.count === null ? "some" : fmtInt(f.count)} revenue event(s) dated after today. They are excluded from the days-without-revenue clock, and the exclusion is shown rather than left silent: one future-dated event could otherwise erase a real crossing.`),
    hasFuture: kill.futureRevenue.length > 0,
    receipt: `criteria ${kill.digest ?? "digest not served"}`,
    receiptTitle: kill.path ?? "path not served",
    badge: kill.badge,
    asOf: kill.asOf === null ? "" : `as of ${kill.asOf}`,
    hasAsOf: kill.asOf !== null,
  };
}

/**
 * The green gate as its strip draws it: whether real money's colour is spent, why, and where that came from.
 * @param {MoneyReads} m
 * @returns {{ isSpent: boolean, why: string, source: string, contradiction: string, hasContradiction: boolean }}
 */
export function gateView(m) {
  return {
    isSpent: m.gate.spendable,
    why: m.gate.why,
    source: m.gate.source,
    contradiction: m.gate.contradiction ?? "",
    hasContradiction: m.gate.contradiction !== null,
  };
}
