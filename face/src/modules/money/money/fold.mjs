// fold.mjs -- money/money: every decision the money room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Money onto the door, replacing the carried Cycle 15 renderer (MoneyRoom.tsx, deleted).
// "Real and simulated are different substances": the real P&L and the simulated one are two reads of two
// kinds, never summed, never averaged, never in one row, and real money's colour stays unspent until
// revenue.received has fired (money.mjs's green gate, which fails closed). What is real: both P&Ls, the cost
// lines counted by currency, the kill lines from ventures.yaml, the money brain's own flags, and -- through
// /api/pnl?by=day (Phase 04) -- v0.7's fourteen days, from the money brain's own day series: real, simulated and
// the cost lines each drawn as its own series, never one row and never one line. What is not served: the milestone
// line and the account of where money comes from, which were facts typed into the reference and live in no file a
// parser reads. Recording real
// revenue, setting criteria and closing a month are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import {
  COST_KIND, OVERHEAD_VENTURE, REAL_KIND, SIM_KIND, asOfSupport, costTally, fileBorneNote, fmtInt, moneyFlags, rupees,
  notServed as routeGaps, returnStatement,
} from "../../../lib/money.mjs";
import { costView, gateView, killLinesView, moneyReads, substanceView } from "../../../lib/money-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/money.mjs").Figure} Figure */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {boolean} isRealFired
 * @property {string} badge
 * @property {string} mode
 * @property {string} readAt
 * @property {ReturnType<typeof gateView>} gate
 * @property {{ key: string, label: string, sub: string, figure: Figure }[]} figures
 * @property {{ key: string, v: string, l: string, sub: string }[]} counts
 * @property {import("../../../lib/money-room.mjs").SubstanceView} realPanel
 * @property {import("../../../lib/money-room.mjs").SubstanceView} simPanel
 * @property {string} neverAdded
 * @property {import("../../../lib/money-room.mjs").CostView} productCost
 * @property {import("../../../lib/money-room.mjs").CostView} overheadCost
 * @property {{ code: string, human: string, parts: { label: string, value: string, why: string }[], command: string }} ret
 * @property {import("../../../lib/money-room.mjs").KillLinesView} kill
 * @property {{ key: string, type: string, venture: string, detail: string, isSim: boolean, hatch: string }[]} flags
 * @property {boolean} hasFlags
 * @property {{ what: string, why: string }[]} gaps
 * @property {{ half: string, source: string, badge: string, hasBadge: boolean, asof: string }[]} provenance
 * @property {{ code: string, offer: string }} asof
 * @property {import("../../../lib/served.mjs").ServedTable} chart
 * @property {import("../../../lib/served.mjs").ServedTable} chartSim
 * @property {import("../../../lib/served.mjs").ServedTable} chartCost
 * @property {import("../../../lib/registry.mjs").NotServed} milestones
 * @property {import("../../../lib/registry.mjs").NotServed} sources
 * @property {{ isVerbPending: true, verb: string, sentence: string }} recordVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} criteriaVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} closeVerb
 * @property {string[]} northStar
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const m = moneyReads(payloads, ctx);
  // The day series: ONE read, three series drawn apart. The money brain derived real and simulated in two calls; the
  // fold keeps them in two tables, so no row ever holds both substances (the room's own law, above).
  const daySt = servedRead(payloads, ctx, m.reads, "/api/pnl", { by: "day" });
  const dayWrong = daySt.isRead && field(daySt.body, "by") !== "day";
  /** @param {string} key @param {(d: Record<string, unknown>) => unknown} pick */
  const series = (key, pick) => projected(dayWrong ? { ...daySt, isRead: false, isRefused: true, refusal: { code: "WRONG_SERIES", human: "this room asked /api/pnl for its day series and the body it answered with is the month model" } } : daySt, key,
    (b) => (Array.isArray(b["series"]) ? b["series"].map((d) => ({ day: asObject(d)["day"], value: pick(asObject(d)) })) : undefined));
  /**
   * @param {string} panel @param {string} key @param {string} heading @param {string} note
   * @param {(d: Record<string, unknown>) => string} pick  the one cell this series shows for a day
   */
  const dayTable = (panel, key, heading, note, pick) => servedTable(series(key, pick), {
    panel,
    route: "/api/pnl",
    columns: ["IST day", heading],
    listKey: key,
    empty: "The day series came back with no day in it.",
    row: (r) => (field(r, "day") === "" ? null : { key: field(r, "day"), cells: [field(r, "day"), cell(r["value"])] }),
    note,
  });
  const realPanel = substanceView(m, "real");
  const simPanel = substanceView(m, "simulated");
  const real = m.realView;
  const ventureCosts = real === null ? [] : real.ventures.flatMap((v) => v.costs);
  const overheadLines = real === null ? [] : real.overhead.lines;
  const productTally = costTally(ventureCosts, "GET /api/pnl → model.ventures[].costs[]");
  const overheadTally = costTally(overheadLines, "GET /api/pnl → model.overhead.lines[]");
  const allTally = costTally([...ventureCosts, ...overheadLines], "GET /api/pnl → every cost line served");
  const ret = returnStatement({ gate: m.gate, real, cost: allTally });
  /** @type {import("../../../lib/money.mjs").PnlView[]} */
  const views = [];
  if (m.realView !== null) views.push(m.realView);
  if (m.simView !== null) views.push(m.simView);
  const flags = moneyFlags(views);
  const asof = asOfSupport();
  const costFigure = m.real.isRead ? fmtInt(allTally.lines.length) : "—";
  return {
    // The shell decoded the served registry once; decoding it again would manufacture a `<` (Phase 03 attack).
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    isRealFired: m.gate.spendable,
    badge: m.gate.spendable ? "real ₹ on the log" : "every ₹ below is labelled",
    mode: m.mode,
    readAt: m.readAt,
    gate: gateView(m),
    figures: [
      { key: "real", label: "Real revenue", sub: `${REAL_KIND} · the only substance here that is money`, figure: realPanel.cashIn },
      { key: "sim", label: "Simulated revenue", sub: `${SIM_KIND} · never added to the real`, figure: simPanel.cashIn },
    ],
    counts: [
      { key: "costs", v: costFigure, l: "Cost lines served", sub: m.real.isRead ? `${COST_KIND} · counted, never summed` : m.real.isRefused ? m.real.refusal.code : "reading the P&L" },
      { key: "return", v: "—", l: "Return", sub: ret.code },
    ],
    realPanel,
    simPanel,
    neverAdded: `These two panels are never added, never averaged, and never placed in one row. They come from two separate reads of two separate kinds, ${REAL_KIND} and ${SIM_KIND}, and the money brain selects one kind at the top and never reads the other. Nothing on this screen combines them, because there is no quantity a combination of them would be.`,
    productCost: costView(`${COST_KIND} — attributed to a product`, "what a venture cost. Every line is one receipt, in the currency it was recorded in.", productTally, m.real),
    overheadCost: costView(`${COST_KIND} — overhead (venture: ${OVERHEAD_VENTURE})`, "building the factory is not a cost of any product made in it, so these are never attributed to a venture.", overheadTally, m.real),
    ret: { code: ret.code, human: ret.human, parts: ret.parts, command: ret.command },
    kill: killLinesView(m),
    // A simulated flag wears the non-real texture, decided here so the View draws one value.
    flags: flags.map((f) => ({ key: `${f.substance}:${f.type}:${f.venture}:${f.detail}`, type: f.type, venture: f.venture, detail: f.detail, isSim: f.substance === "simulated", hatch: f.substance === "simulated" ? "var(--sim-hatch)" : "" })),
    hasFlags: flags.length > 0,
    gaps: routeGaps({ real: m.realView, sim: m.simView, health: m.healthView }),
    provenance: fileBorneNote().map((n) => ({ half: n.half, source: n.source, badge: n.badge ?? "", hasBadge: n.badge !== null, asof: n.asof })),
    asof: { code: asof.code, offer: asof.offer },
    chart: dayTable("Fourteen days", "real", `${REAL_KIND} · ₹ cash in`, "real money, by the day each receipt was recorded -- the only one of the three that is money",
      (d) => (typeof d["realRows"] === "number" && d["realRows"] > 0 ? `₹${rupees(d["realMinor"]).text} · ${cell(d["realRows"])} receipt${d["realRows"] === 1 ? "" : "s"}` : "no receipt")),
    chartSim: dayTable("Fourteen days, simulated", "simulated", `${SIM_KIND} · ₹, labelled`, "simulated revenue, drawn apart and never added to the real",
      (d) => (typeof d["simulatedRows"] === "number" && d["simulatedRows"] > 0 ? `₹${rupees(d["simulatedMinor"]).text} simulated · ${cell(d["simulatedRows"])} receipt${d["simulatedRows"] === 1 ? "" : "s"}` : "no receipt")),
    chartCost: dayTable("Fourteen days, cost lines", "cost", `${COST_KIND} · lines, by currency`, "cost lines counted by the currency each was recorded in, never summed",
      (d) => {
        const lines = asArray(d["costLines"]).map((c) => `${cell(asObject(c)["lines"])} in ${field(asObject(c), "currency")}`);
        return lines.length > 0 ? lines.join(" · ") : "no cost line";
      }),
    milestones: notServed(
      "The milestone line",
      "/api/strategy",
      "The honest ranges the company has written down for when money arrives, read from its strategy documents rather than typed into this screen. They are prose in the master execution plan, and no parser reads them -- filed to the plan lane.",
    ),
    sources: notServed(
      "Where money comes from",
      "/api/ventures",
      "Each venture's revenue model and price, and what the factory itself may earn, from each venture's own record -- never a sentence typed into this room. No venture record carries a revenue model or a price: ventures.yaml holds kill criteria only -- filed to the ledger lane.",
    ),
    recordVerb: verbPending(
      "Record real revenue",
      "revenue.received is recorded by a person's hand only, through the ledger's ingest; the first one opens the green gate and resets the kill clock. It arrives with the work door.",
    ),
    criteriaVerb: verbPending(
      "Set a venture's kill criteria",
      "Criteria are written at kickoff into ventures.yaml and approved by your stamp; a change is a reviewed diff, never an edit on a screen. It arrives with the work door.",
    ),
    closeVerb: verbPending(
      "Close the month",
      "month.closed seals a month's P&L so it replays to the same figures for ever. It arrives with the work door.",
    ),
    northStar: [
      "Rupees a month of revenue, per hour of the owner's week.",
      "The only number arc optimises. A feature that adds human hours is a regression, however impressive it looks.",
    ],
    reads: m.reads,
  };
}
