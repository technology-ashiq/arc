// fold.mjs -- command/board: every decision the portfolio screen makes, where node can import it with
// no install (face v2 Phase 03, ADR-1320, ADR-1324).
//
// The port of v0.7's Board onto the door. Every lane VALUE is its own PROGRESS header, parsed by
// spine.mjs's board readers (the board is a view; the lane files are the truth, ADR-0051); the totals
// leave out and COUNT a lane whose header records no appetite or burn, never summing it as zero. The
// pipeline counts today's receipts by the kind each stage names. The venture cards are read from /api/ventures
// (Phase 04): each venture's kill criteria, evaluated by the ledger's own kill panel. v0.7 drew them from a
// simulated portfolio. The base rate is still NOT SERVED: no file the door can parse states it.
import { notServed, payloadOf } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import { dayOf, decodeDoorText, fmtInt, readHealth, readSpinePage } from "../../../lib/inbox.mjs";
import { boardProvenance, boardRows, boardTotals, fmtDays, sharePct } from "../../../lib/spine.mjs";

const FEED_LIMIT = 1000;

/** The pipeline, idea to money: each stage a kind on the closed vocabulary, counted today. */
const STAGES = Object.freeze([
  { name: "Captured", kind: "idea.captured", note: "ideas captured today" },
  { name: "Council", kind: "council.verdict", note: "verdicts recorded today" },
  { name: "Kickoff", kind: "kickoff.done", note: "kickoffs done today" },
  { name: "Building", kind: "", note: "lanes whose header reads LIVE" },
  { name: "Shipped", kind: "ship.done", note: "ships done today" },
  { name: "Earning", kind: "revenue.received", note: "real revenue receipts today" },
]);

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {object} LaneRow
 * @property {string} lane
 * @property {string} room
 * @property {boolean} canOpen
 * @property {string} status
 * @property {string} statusInk
 * @property {string} phase
 * @property {string} sub
 * @property {string} appetite
 * @property {number} meter
 * @property {string} pct
 * @property {string} distance
 * @property {boolean} isPast
 *
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {{ isReading: boolean, isRefused: boolean, hasRows: boolean, refusal: { code: string, human: string }, rows: LaneRow[], foot: string }} lanes
 * @property {{ value: string, label: string }[]} sorts
 * @property {string} sort
 * @property {{ key: string, name: string, n: string, note: string }[]} pipeline
 * @property {string} pipelineHint
 * @property {import("../../../lib/served.mjs").ServedTable} ventures
 * @property {import("../../../lib/registry.mjs").NotServed} baseRate
 * @property {boolean} canOpenOrg
 * @property {string} orgRoom
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

// The kill-distance card, from the ledger's kill panel through /api/ventures (Phase 04). It lives in this fold, not in
// lib/served.mjs: it reads the body's venture list by name, and a shell file names no room (module-frame's scan).
/**
 * Each venture's distance from its kill lines, one row per criterion, as the ledger's kill panel evaluated them
 * (/api/ventures). A criteria file whose digest no receipt pins is NOT evaluated -- the panel says the kill lines
 * are unarmed rather than drawing distances the ledger refused to compute.
 * @param {import("../../../lib/served.mjs").ServedState} st @param {string} panel
 * @returns {import("../../../lib/served.mjs").ServedTable}
 */
function venturesKill(st, panel) {
  const kill = asObject(st.body["kill"]);
  const armed = kill["present"] === true && kill["receipted"] === true;
  return servedTable(projected(st, "rows", (b) => {
    const k = asObject(b["kill"]);
    if (!Array.isArray(k["ventures"])) return undefined;
    return k["ventures"].flatMap((v) => asArray(asObject(v)["criteria"]).map((c) => ({ ...asObject(c), venture: asObject(v)["venture"] })));
  }), {
    panel,
    route: "/api/ventures",
    columns: ["venture", "kill criterion", "status", "distance to the line"],
    listKey: "rows",
    empty: kill["present"] !== true
      ? "ventures.yaml is not on this tree, so no venture has a kill line."
      : kill["receipted"] !== true
        ? "The criteria file's digest is pinned by no receipt, so the ledger arms no kill line and computes no distance."
        : "The criteria file names no venture.",
    row: (c) => {
      const venture = field(c, "venture");
      const criterion = field(c, "criterion");
      const unit = field(c, "unit");
      const distance = c["distance"] === null || c["distance"] === undefined ? (field(c, "reason") || "not measured") : `${cell(c["distance"])}${unit ? ` ${unit}` : ""}`;
      return venture === "" || criterion === "" ? null : { key: `${venture}/${criterion}`, cells: [venture, `${criterion} ${cell(c["threshold"])}`, field(c, "status"), distance] };
    },
    note: armed ? `evaluated on ${field(kill, "asOf")} from ${field(kill, "path")} by the ledger's kill panel` : "",
  });
}

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [{ route: "/api/board", poll: true }, { route: "/api/health", poll: true }];
  const boardP = payloadOf(payloads, { route: "/api/board" });
  const view = boardP.state === "ok" ? boardRows(boardP.data) : null;
  const badBody = view !== null && "code" in view ? view : null;
  const board = view !== null && !("code" in view) ? view : null;
  const rows = board === null ? [] : board.rows;
  const totals = boardTotals(rows);

  const healthP = payloadOf(payloads, { route: "/api/health" });
  const health = healthP.state === "ok" ? readHealth(healthP.data) : null;
  const day = health === null ? "" : dayOf(health.now);
  const feedRead = day === "" ? null : { route: "/api/spine", query: { date: day, limit: FEED_LIMIT }, poll: true };
  if (feedRead !== null) reads.push(feedRead);
  const venturesSt = servedRead(payloads, ctx, reads, "/api/ventures");
  const feedP = feedRead === null ? null : payloadOf(payloads, feedRead);
  const events = feedP !== null && feedP.state === "ok" ? readSpinePage(feedP.data).events : [];

  const laneMap = ctx.laneMap && typeof ctx.laneMap === "object" ? ctx.laneMap : {};
  const served = new Set((ctx.rooms || []).map((r) => r.id));
  const sort = picks.sort === "burn" || picks.sort === "status" ? picks.sort : "board";
  const ordered = rows.slice();
  if (sort === "burn") ordered.sort((a, b) => (b.meter.fraction ?? -1) - (a.meter.fraction ?? -1));
  if (sort === "status") ordered.sort((a, b) => (a.status.label < b.status.label ? -1 : a.status.label > b.status.label ? 1 : 0));

  const laneRows = ordered.map((r) => {
    const room = Object.hasOwn(laneMap, r.lane) ? String(laneMap[r.lane]) : "";
    const phase = r.phase.number === null ? (r.cycle === null ? "—" : decodeDoorText(r.cycle)) : `phase ${r.phase.number}`;
    return {
      lane: r.lane,
      room,
      canOpen: room !== "" && served.has(room),
      status: r.status.label,
      statusInk: r.status.ink,
      phase,
      sub: r.blockedOn !== null ? `waiting on: ${decodeDoorText(r.blockedOn)}` : r.phase.note === null ? "" : decodeDoorText(r.phase.note),
      appetite: r.meter.state === "measured" ? `${fmtDays(r.burn.days ?? Number.NaN)} / ${fmtDays(r.appetite.days ?? Number.NaN)}` : "not stated",
      meter: r.meter.fill ?? 0,
      pct: r.meter.fraction === null ? "—" : `${Math.round(r.meter.fraction * 100)}%`,
      distance: r.meter.label,
      isPast: r.meter.past,
    };
  });

  const counts = (/** @type {string} */ kind) => events.filter((e) => e.kind === kind).length;
  const burnPct = sharePct(totals.spent, totals.bought);

  return {
    sentence: decodeDoorText(ctx.room.sentence),
    lede: decodeDoorText(ctx.room.lede),
    badge: board === null ? "board unread" : `board · ${fmtInt(rows.length)} lanes · ${board.badge}`,
    kpis: [
      { key: "lanes", v: board === null ? "—" : fmtInt(totals.lanes), l: "Lanes on the board", sub: "PORTFOLIO.md's order" },
      { key: "live", v: board === null ? "—" : fmtInt(totals.live), l: "Live", sub: "header reads LIVE" },
      { key: "blocked", v: board === null ? "—" : fmtInt(totals.blocked), l: "Blocked", sub: "header names what blocks it" },
      { key: "spent", v: board === null ? "—" : `${fmtDays(totals.spent)} / ${fmtDays(totals.bought)}`, l: "Appetite spent / bought", sub: totals.unmeasured > 0 ? `${fmtInt(totals.unmeasured)} lanes not summed` : "every lane measured" },
      { key: "burn", v: burnPct === null ? "not stated" : `${burnPct}%`, l: "Company burn", sub: "spent over bought, measured lanes" },
      { key: "past", v: board === null ? "—" : fmtInt(totals.past), l: "Lanes past the line", sub: "burn beyond appetite" },
    ],
    lanes: {
      isReading: boardP.state === "loading",
      isRefused: boardP.state === "refused" || badBody !== null,
      hasRows: laneRows.length > 0,
      refusal: boardP.state === "refused" ? { code: boardP.code, human: boardP.human } : badBody !== null ? { code: badBody.code, human: badBody.human } : { code: "", human: "" },
      rows: laneRows,
      foot: board === null ? "" : `${totals.sentence} ${boardProvenance(board)}`,
    },
    sorts: [
      { value: "board", label: "sort · board order" },
      { value: "burn", label: "sort · burn" },
      { value: "status", label: "sort · status" },
    ],
    sort,
    pipeline: STAGES.map((s) => ({
      key: s.name,
      name: s.name,
      n: s.kind === "" ? (board === null ? "—" : fmtInt(totals.live)) : feedP !== null && feedP.state === "ok" ? fmtInt(counts(s.kind)) : "—",
      note: s.note,
    })),
    pipelineHint: day === "" ? "idea → money · reading the door's day" : `idea → money · counted from ${day}'s receipts by kind`,
    canOpenOrg: served.has("org"),
    orgRoom: served.has("org") ? "org" : "",
    // v0.7 typed "1 in 4" into this panel; a number no route serves is a NOT SERVED panel (Phase 03 spec-fidelity).
    baseRate: notServed(
      "The base rate",
      "/api/ventures",
      "How many ventures the kill criteria were planned to expect to live, written before the first launch -- so a death is a data point, not a surprise. The criteria file does not state it: the figure is prose in the master execution plan, which no parser reads -- filed to the ledger lane.",
    ),
    ventures: venturesKill(venturesSt, "Ventures"),
    reads,
  };
}
