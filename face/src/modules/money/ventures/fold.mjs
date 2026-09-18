// fold.mjs -- money/ventures: every decision the ventures room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Ventures onto the door, replacing the carried Cycle 15 renderer (VenturesRoom.tsx,
// deleted). "The factory is not the product": every venture with its own money and its own kill lines, joined
// from two authorities and trusting neither alone -- ventures.yaml (through the kill panel) says which ventures
// exist, /api/pnl says what each one earned, and the roster is their union (money.mjs ventureRoster), so a venture
// spending money with no kill line is a finding rather than a missing row. Through /api/ventures (Phase 04): the
// file's own rules as the ledger's parser enforces them -- the closed set of criteria, the ceiling, the digest over
// the parsed values. What is still NOT SERVED: each venture's passport and the base rate, because ventures.yaml holds
// only kill criteria and no parser reads either from anywhere else. Registering, staging and proposing a kill are
// verbs of the work door (Phase 05).
import { notServed, readProblem, payloadOf, verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import {
  KILL_BADGE, OVERHEAD_VENTURE, REAL_KIND, SIM_KIND, asOfSupport, costTally, criterionSentence, fmtInt, killSummary,
  rosterSummary, ventureMoney, ventureRoster,
} from "../../../lib/money.mjs";
import { costView, gateView, moneyReads, substanceView } from "../../../lib/money-room.mjs";
import { roomLink, sourceFile } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/money.mjs").Figure} Figure */
/** @typedef {import("../../../lib/money-room.mjs").CostView} CostView */

/**
 * @typedef {object} VentureCard
 * @property {string} key
 * @property {string} venture
 * @property {boolean} isDeclared
 * @property {string} badge
 * @property {string} badgeTitle
 * @property {boolean} hasWorst
 * @property {string} worst
 * @property {boolean} isWorstLoud
 * @property {boolean} isDanger
 * @property {string} earned
 * @property {Figure} real
 * @property {Figure} mrr
 * @property {Figure} sim
 * @property {(Figure & { label: string })[]} components
 * @property {boolean} hasComponents
 * @property {boolean} hasKill
 * @property {{ key: string, criterion: string, headline: string, ink: string, detail: string, isAbsent: boolean }[]} criteria
 * @property {string} noKill
 * @property {string} absentNote
 * @property {boolean} hasAbsentNote
 * @property {boolean} hasFinding
 * @property {{ code: string, human: string }} finding
 * @property {CostView} cost
 */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {boolean} isRealFired
 * @property {string} badge
 * @property {ReturnType<typeof gateView>} gate
 * @property {{ key: string, label: string, sub: string, figure: Figure }[]} figures
 * @property {{ key: string, v: string, l: string, sub: string }[]} counts
 * @property {{ headline: string, detail: string, badge: string }} summary
 * @property {{ isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } }} roster
 * @property {boolean} hasKillNote
 * @property {boolean} isKillLoud
 * @property {{ code: string, human: string }} killNote
 * @property {VentureCard[]} cards
 * @property {boolean} hasCards
 * @property {string} neverMix
 * @property {CostView} overhead
 * @property {string} overheadLede
 * @property {string} declared
 * @property {import("../../../lib/lane-room.mjs").SourceFile} file
 * @property {import("../../../lib/registry.mjs").NotServed} passports
 * @property {import("../../../lib/served.mjs").ServedTable} rules
 * @property {{ isVerbPending: true, verb: string, sentence: string }} registerVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} stageVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} killVerb
 * @property {string} trailNote
 * @property {import("../../../lib/registry.mjs").NotServed} baseRate
 * @property {string} shipWith
 * @property {{ canOpen: boolean, room: string }} board
 * @property {{ canOpen: boolean, room: string }} money
 * @property {{ code: string, offer: string }} asof
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const m = moneyReads(payloads, ctx);
  const reads = [...m.reads];
  const venturesSt = servedRead(payloads, ctx, reads, "/api/ventures");
  // ventures.yaml's provenance -- the file the passports and the rules will be parsed from once their route
  // exists. Asked for only if the manifest allows it, like every read.
  const fileRead = { route: "/api/file/:id", param: "ventures" };
  const fileWhy = readProblem(fileRead, ctx.manifest);
  if (fileWhy === null) reads.push(fileRead);
  const file = fileWhy === null
    ? sourceFile("ventures", payloadOf(payloads, fileRead))
    : { id: "ventures", isReading: false, isRefused: true, isRead: false, refusal: { code: "READ_REFUSED", human: fileWhy }, path: "", sha: "", size: "" };

  const kill = m.killView;
  // The roster needs the kill panel to know which ventures are DECLARED. Until it arrives there is no roster --
  // and an empty roster is not drawn in its place: "the company has no ventures" and "the read has not
  // finished" are different claims.
  // A kill panel that is not a PANEL -- the criteria file changed with no approving receipt, or not served --
  // measured nothing: its counts are unread, never a clean 0 beside the refusal that says why (money ring shots),
  // and no roster is drawn from it, because every venture would read "no kill lines" when the file DOES declare
  // them and only its approval is missing (money ring attack). An ABSENT file is different: it declares nothing,
  // so money booked to a venture is truly booked with no kill line, and that roster is drawn.
  const isPanel = kill !== null && kill.state === "panel";
  const rosterable = kill !== null && (kill.state === "panel" || kill.state === "absent");
  const rows = rosterable && kill !== null ? ventureRoster({ real: m.realView, sim: m.simView, kill }) : [];
  const summary = kill === null ? { headline: "reading", detail: "" } : rosterSummary(rows, kill);
  const counts = isPanel ? killSummary(kill).counts : null;
  const unread = kill === null ? (m.real.isRefused ? m.real.refusal.code : "reading the kill panel") : kill.refusal !== null ? kill.refusal.code : "no kill panel";
  // The refusal is drawn once, as its own card below the headline; the headline's sentence points at it rather
  // than repeating it word for word (money ring shots).
  const detail = kill !== null && kill.refusal !== null && rows.length === 0
    ? "No roster is drawn until the criteria file has an approving receipt; the refusal below says what changed and how to clear it."
    : summary.detail;
  const served = { real: m.real.isRead, sim: m.sim.isRead };
  /** @type {VentureCard[]} */
  const cards = rows.map((row) => {
    const money = ventureMoney(row, m.gate, served);
    const worst = row.kill === null ? null : row.kill.worst;
    const absent = row.kill === null ? null : row.kill.absentCount;
    return {
      key: row.venture,
      venture: row.venture,
      isDeclared: row.declared,
      badge: row.declared ? "declared" : "no kill lines",
      badgeTitle: row.declared
        ? "named in ventures.yaml, whose criteria have an approved receipt on the spine"
        : "money is booked to this venture and ventures.yaml declares no kill line for it",
      hasWorst: worst !== null,
      worst: worst ?? "",
      isWorstLoud: worst === "CROSSED",
      isDanger: worst === "CROSSED" || worst === "WARNING" || !row.declared,
      earned: money.earnedSentence,
      real: money.real,
      mrr: money.mrr,
      sim: money.sim,
      components: money.components,
      hasComponents: money.components.length > 0,
      hasKill: row.kill !== null,
      criteria: row.kill === null ? [] : row.kill.criteria.map((c) => {
        const said = criterionSentence(c);
        return { key: c.criterion, criterion: c.criterion, headline: said.headline, ink: said.ink, detail: said.detail, isAbsent: said.state === "absent" };
      }),
      noKill: `ventures.yaml declares no kill line for ${row.venture}. There is no line to measure a distance to, so no distance is drawn -- and nothing here reads that absence as safety.`,
      absentNote: absent === null || absent === 0
        ? ""
        : `${fmtInt(absent)} criteri${absent === 1 ? "on" : "a"} could not be evaluated. They are listed above with the reason rather than dropped: a shorter list is a greener one, and indistinguishable from a healthy venture.`,
      hasAbsentNote: absent !== null && absent > 0,
      hasFinding: row.finding !== null,
      finding: row.finding ?? { code: "", human: "" },
      cost: costView("what it cost", `every cost receipt booked to ${row.venture}, counted and never summed`, money.cost, m.real),
    };
  });
  const realPanel = substanceView(m, "real");
  // Which ventures are DECLARED has one reader: the kill panel, the same body the cards' badges read. The
  // registry's inventory beside it was a second reading of the same fact, and the two could disagree on one
  // screen (money ring attack).
  const names = isPanel && kill !== null ? kill.ventures.map((v) => v.venture).sort() : null;
  const asof = asOfSupport();

  return {
    // The shell decoded the served registry once; decoding it again would manufacture a `<` (Phase 03 attack).
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    isRealFired: m.gate.spendable,
    badge: `${KILL_BADGE} — the venture set`,
    gate: gateView(m),
    figures: [
      { key: "real", label: "Real ₹ to date", sub: `${REAL_KIND} · per venture below, never summed here`, figure: realPanel.cashIn },
    ],
    counts: [
      { key: "ventures", v: isPanel ? fmtInt(rows.length) : "—", l: "Ventures in the roster", sub: isPanel ? "declared or carrying money" : unread },
      // The cause is named once, on the first tile; the other two say what they wait on, so three dashes do not
      // carry one caption three times (money ring shot review).
      { key: "crossed", v: counts === null ? "—" : fmtInt(counts.crossed), l: "Kill lines crossed", sub: counts === null ? "unread · no distance is drawn without the roster" : `${fmtInt(counts.warning)} inside the warning band` },
      { key: "undeclared", v: isPanel ? fmtInt(rows.filter((r) => !r.declared).length) : "—", l: "Money with no kill line", sub: isPanel ? "a finding, never a quiet row" : "unread · no finding is made without the roster" },
    ],
    summary: { headline: summary.headline, detail, badge: `${KILL_BADGE} — the venture set` },
    roster: { isReading: m.real.isReading, isRefused: m.real.isRefused, refusal: m.real.refusal },
    hasKillNote: kill !== null && kill.refusal !== null,
    isKillLoud: kill !== null && kill.state === "unreceipted",
    killNote: kill !== null && kill.refusal !== null ? kill.refusal : { code: "", human: "" },
    cards,
    hasCards: cards.length > 0,
    neverMix: `The real figure and the simulated one come from two separate reads of two separate kinds, ${REAL_KIND} and ${SIM_KIND}. They are never added, never averaged, and the simulated one never wears the colour of the real one.`,
    overhead: costView(
      `the factory · venture: ${OVERHEAD_VENTURE}`,
      `building the factory is not a cost of any product made in it, so venture: ${OVERHEAD_VENTURE} is overhead and never appears as a venture above. It is shown so its spend is not invisible -- not so it can be counted against a product.`,
      costTally(m.realView === null ? [] : m.realView.overhead.lines, "GET /api/pnl → model.overhead.lines[]"),
      m.real,
    ),
    overheadLede: "",
    declared: names === null
      ? "Which ventures are declared is read from the criteria file's kill panel, and there is no readable panel on this read -- a fact about the read, not about the company."
      : names.length === 0
        ? "ventures.yaml declares no ventures. That is a measured zero, not a missing read: the file was there and it was empty."
        : `Declared in ventures.yaml: ${names.join(", ")} -- ${names.length === 1 ? "one venture, carrying a kill line" : `${fmtInt(names.length)} ventures, each carrying a kill line`}. A venture appears here the moment it is declared, whether or not it has earned anything.`,
    file,
    passports: notServed(
      "Passports",
      "/api/ventures",
      "Each venture's passport -- live, candidate or attic, its stage and its own repo -- with a row that leaves only by your stamp and never by deletion. ventures.yaml holds kill criteria only; the passports are a PORTFOLIO.md table that only the board lint's awk reads -- filed to the ledger lane.",
    ),
    rules: servedTable(projected(venturesSt, "rows", (b) => {
      if (!Array.isArray(b["criteria"]) || !Array.isArray(b["ventures"])) return undefined;
      return [
        { rule: "the schema version", value: cell(b["version"]) },
        { rule: "the only kill criteria a venture may declare", value: b["criteria"].map(cell).join(", ") },
        { rule: "the ceiling on any criterion", value: cell(b["ceiling"]) },
        { rule: "the digest, over the parsed values", value: field(b, "digest").slice(0, 16) },
        ...b["ventures"].map((v) => ({ rule: `${field(asObject(v), "name")} declares`, value: asArray(asObject(v)["kill"]).map((k) => `${field(asObject(k), "criterion")} ${cell(asObject(k)["value"])}`).join(" · ") })),
      ];
    }), {
      panel: "The rules of the file",
      route: "/api/ventures",
      columns: ["rule", "as the ledger's parser holds it"],
      listKey: "rows",
      empty: "ventures.yaml parsed to nothing.",
      row: (r) => (field(r, "rule") === "" ? null : { key: field(r, "rule"), cells: [field(r, "rule"), field(r, "value") || "—"] }),
      note: "money never lives in this file: a key outside the two criteria is refused by the parser, and the file's prose rules are comments it does not keep",
    }),
    registerVerb: verbPending(
      "Register a venture",
      "venture.registered makes a candidate, and its kill line is written before its first launch. It arrives with the work door.",
    ),
    stageVerb: verbPending(
      "Stage a venture",
      "Kickoff, building, launched, live -- each move a receipt, and the venture track wins every tie. It arrives with the work door.",
    ),
    killVerb: verbPending(
      "Propose a kill review",
      "A kill is a stamped decision: the attic with a retro, components harvested, the lesson pinned -- never a deletion. The proposal lands in your inbox with the work door.",
    ),
    trailNote: "The spine records no venture.* kind yet: registering, staging and killing a venture are work-door verbs, and their receipts land here the day they exist.",
    // The base rate is a number, and no route serves it yet: v0.7 typed "1 in 4" here (Phase 03 spec-fidelity).
    baseRate: notServed(
      "The base rate",
      "/api/ventures",
      "How many ventures the kill criteria were planned to expect to live, written before the first launch -- so a death is a data point, not a surprise. The criteria file does not state it: the figure is prose in the master execution plan, which no parser reads -- filed to the ledger lane.",
    ),
    shipWith: "A venture without a distribution plan does not ship. Launch week is a written playbook -- a channel at a time, personal and honest -- and growth wakes as a module only when a live venture pulls it.",
    board: roomLink(ctx, "board"),
    money: roomLink(ctx, "money"),
    asof: { code: asof.code, offer: asof.offer },
    reads,
  };
}
