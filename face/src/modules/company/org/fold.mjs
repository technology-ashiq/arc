// fold.mjs -- company/org: every decision the org room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1324, ADR-1326; carried finding F1).
//
// The port of v0.7's Org onto the door. The roster is the board's lanes, each value read from the lane's own machine
// header (ADR-0051): its status, its phase, its cycle, and the one thing it waits on. The ADR band map names the LANE
// that owns each century (F1), read from PORTFOLIO.md's band table -- the record of which lane claimed which century --
// never the room the contract homes a band in, which is what Cycle 15's panel printed. What /api/lanes will fold (the
// receipts each lane fired today) is NOT SERVED; setting a lane's status and birthing a lane are work-door verbs.
import { notServed, payloadOf, readProblem, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { boardRows, boardTotals } from "../../../lib/spine.mjs";
import { bandsOf, fileText } from "../../../lib/company-room.mjs";
import { roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {{ isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } }} board
 * @property {import("../../../ui/company").RosterView[]} roster
 * @property {{ live: number, idle: number, blocked: number, lanes: number }} counts
 * @property {{ key: string, lane: string, on: string }[]} waiting
 * @property {boolean} isWaitingEmpty
 * @property {string} waitingEmpty
 * @property {{ rows: (import("../../../ui/company").BandView & { lane: string })[], isRead: boolean, isEmpty: boolean, empty: string }} bands
 * @property {import("../../../lib/lane-room.mjs").SourceFile} portfolio
 * @property {import("../../../lib/registry.mjs").NotServed} today
 * @property {{ isVerbPending: true, verb: string, sentence: string }} statusVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} birthVerb
 * @property {Read[]} reads
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Read[]} */
  const reads = [];
  /** @type {Read} */
  const boardRead = { route: "/api/board" };
  const boardWhy = readProblem(boardRead, ctx.manifest);
  if (boardWhy === null) reads.push(boardRead);
  /** @type {Payload} */
  const boardP = boardWhy === null ? payloadOf(payloads, boardRead) : { state: "refused", code: "READ_REFUSED", human: boardWhy };
  const view = boardP.state === "ok" ? boardRows(boardP.data) : null;
  const rows = view !== null && "rows" in view ? view.rows : [];
  const isBoardRead = view !== null && "rows" in view;
  const totals = boardTotals(rows);
  const board = {
    isReading: boardP.state === "loading" || boardP.state === "pending",
    isRefused: boardP.state === "refused" || (view !== null && !("rows" in view)),
    refusal: boardP.state === "refused" ? { code: boardP.code, human: boardP.human } : view !== null && !("rows" in view) ? view : NO_REFUSAL,
  };

  const roster = rows.map((r, i) => {
    const link = roomLink(ctx, r.lane);
    return {
      key: `${i}-${r.lane}`,
      lane: r.lane,
      status: r.status.label,
      ink: r.status.ink,
      phase: r.phase.number === null ? "no phase" : `phase ${r.phase.number}`,
      cycle: r.cycle ?? "no cycle line in its header",
      // The blocked-on line is drawn once, under who is waiting on whom -- never twice on one screen.
      line: "",
      lineInk: "var(--text-2)",
      canOpen: link.canOpen,
    };
  });
  const waiting = rows.filter((r) => r.blockedOn !== null).map((r, i) => ({ key: `${i}-${r.lane}`, lane: r.lane, on: r.blockedOn ?? "" }));

  // F1: the band map names the lane that owns each century, from the portfolio's band table.
  const file = fileText(payloads, ctx, "portfolio", reads);
  const b = bandsOf(file.text);
  const bandRows = b.rows.map((row, i) => {
    const link = row.isLane ? roomLink(ctx, row.lane) : { canOpen: false, room: "" };
    return { key: `${i}-${row.band}`, band: row.band, lane: row.lane, who: row.isLane ? row.lane : row.owner, note: row.brief, title: row.note, isLane: row.isLane, canOpen: link.canOpen, room: link.room };
  });
  const bandsRead = file.source.isRead && b.isRead && !b.unread;

  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: isBoardRead ? `${fmtInt(totals.lanes)} lanes · each value from the lane's own header` : "the board · not read",
    kpis: [
      { key: "live", v: isBoardRead ? fmtInt(totals.live) : "—", l: "Awake", sub: "header reads LIVE" },
      { key: "idle", v: isBoardRead ? fmtInt(totals.idle) : "—", l: "Idle", sub: "no cycle running" },
      { key: "waiting", v: isBoardRead ? fmtInt(waiting.length) : "—", l: "Waiting on something", sub: "a blocked-on line in the header" },
      { key: "bands", v: bandsRead ? fmtInt(b.rows.filter((r) => r.isLane).length) : "—", l: "ADR centuries claimed", sub: "one per lane, PORTFOLIO.md" },
    ],
    board,
    roster,
    counts: { live: totals.live, idle: totals.idle, blocked: totals.blocked, lanes: totals.lanes },
    waiting,
    isWaitingEmpty: waiting.length === 0,
    waitingEmpty: isBoardRead ? "No lane's header names anything it is waiting on." : "",
    bands: {
      rows: bandsRead ? bandRows : [],
      isRead: bandsRead,
      isEmpty: !bandsRead,
      empty: !file.source.isRead ? "" : "The portfolio the door served carries no ADR band table, so no century is drawn -- and none is claimed unowned.",
    },
    portfolio: file.source,
    today: notServed(
      "Receipts per lane today",
      "/api/lanes",
      "Which lanes fired a receipt today, counted per lane -- so a lane whose header says IDLE and that emitted today reads awake, and one whose header says LIVE and fired nothing reads quiet.",
    ),
    statusVerb: verbPending(
      "Set a lane's status",
      "A lane's status is its PROGRESS header; changing it -- awake, idle, blocked on a named thing -- is a reviewed edit that lands as a receipt. It arrives with the work door.",
    ),
    birthVerb: verbPending(
      "Birth a lane",
      "Only /arc-kickoff births a lane: it claims the next ADR century and lands the lane's room in the same change. The work door will start that ceremony from here.",
    ),
    reads,
  };
}
