// fold.mjs -- factory/factory: every decision the factory floor makes, where node can import it with no install
// (face v2 Phase 03, company ring PR, ADR-1320, ADR-1324, ADR-1326, ADR-1337).
//
// v0.7's Factory: the floor. A served room since the owner's section 13 item 5 ruling (ADR-1337). "The current cycle
// and what each phase is waiting on": every lane whose header reads LIVE, the cycle it runs, the phase it is on and
// the one thing it names as blocking it -- each value from the lane's own header through the board (ADR-0051). The
// phase closings and cycle kickoffs the registry homes here are the spine's. The factory's parts -- the products, the
// commands, the agents and the gates -- are counted from the served registry, the list the shell already read. What
// each gate is set to, and the profile that switches them as one, are NOT SERVED until /api/gates.
import { notServed, payloadOf, readProblem, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { boardRows } from "../../../lib/spine.mjs";
import { catalogueOf, countedOn, kindCount, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   board: { isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } },
 *   floor: { key: string, lane: string, cycle: string, phase: string, phaseLine: string, waiting: string, isWaiting: boolean, canOpen: boolean }[],
 *   isFloorEmpty: boolean,
 *   floorEmpty: string,
 *   parts: { key: string, label: string, count: string, sub: string }[],
 *   gates: { key: string, name: string, roomName: string, room: string, canOpen: boolean }[],
 *   isGatesEmpty: boolean,
 *   modes: import("../../../lib/registry.mjs").NotServed,
 *   profileVerb: { isVerbPending: true, verb: string, sentence: string },
 * }} Folded
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });
const PARTS = Object.freeze([
  { key: "products", label: "Products", sub: "install any subset" },
  { key: "commands", label: "Commands", sub: "every one addressable" },
  { key: "agents", label: "Agents", sub: "spawned for a task, then gone" },
  { key: "gates", label: "Gates", sub: "blocking by default" },
]);

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { trailEmpty: "No phase closed and no cycle kicked off on the page the door sent." });
  /** @type {Read[]} */
  const reads = [];
  /** @type {Read} */
  const boardRead = { route: "/api/board" };
  const boardWhy = readProblem(boardRead, ctx.manifest);
  if (boardWhy === null) reads.push(boardRead);
  /** @type {Payload} */
  const boardP = boardWhy === null ? payloadOf(payloads, boardRead) : { state: "refused", code: "READ_REFUSED", human: boardWhy };
  const view = boardP.state === "ok" ? boardRows(boardP.data) : null;
  const isBoardRead = view !== null && "rows" in view;
  const rows = isBoardRead ? view.rows : [];
  const floor = rows.filter((r) => r.status.tone === "live").map((r, i) => ({
    key: `${i}-${r.lane}`,
    lane: r.lane,
    cycle: r.cycle ?? "no cycle line in its header",
    phase: r.phase.number ?? "",
    phaseLine: r.phase.number === null ? "no phase in its header" : `phase ${r.phase.number}${r.phase.note === null ? "" : ` · ${r.phase.note}`}`,
    waiting: r.blockedOn === null ? "" : `waiting on: ${r.blockedOn}`,
    isWaiting: r.blockedOn !== null,
    canOpen: roomLink(ctx, r.lane).canOpen,
  }));
  const cat = catalogueOf(ctx, PARTS.map((p) => p.key));
  const parts = PARTS.map((p) => {
    const sec = cat[p.key] ?? { rows: [], unreadable: [] };
    return { key: p.key, label: p.label, count: sec.unreadable.length > 0 ? "—" : fmtInt(sec.rows.length), sub: p.sub };
  });
  const gateRows = (cat["gates"] ?? { rows: [] }).rows;
  return {
    ...base,
    reads: [...base.reads, ...reads],
    badge: isBoardRead ? `${fmtInt(floor.length)} cycle${floor.length === 1 ? "" : "s"} on the floor` : "the floor · not read",
    kpis: [
      { key: "running", v: isBoardRead ? fmtInt(floor.length) : "—", l: "Cycles running", sub: "a lane whose header reads LIVE" },
      { key: "waiting", v: isBoardRead ? fmtInt(floor.filter((f) => f.isWaiting).length) : "—", l: "Waiting on something", sub: "a blocked-on line in the header" },
      { key: "closed", v: kindCount(base, "phase.closed"), l: "Phases closed", sub: countedOn(base, "phase.closed") },
      { key: "kickoffs", v: kindCount(base, "kickoff.done"), l: "Cycles kicked off", sub: countedOn(base, "kickoff.done") },
    ],
    board: {
      isReading: boardP.state === "loading" || boardP.state === "pending",
      isRefused: boardP.state === "refused" || (view !== null && !isBoardRead),
      refusal: boardP.state === "refused" ? { code: boardP.code, human: boardP.human } : view !== null && !("rows" in view) ? view : NO_REFUSAL,
    },
    floor,
    isFloorEmpty: floor.length === 0,
    floorEmpty: isBoardRead ? "No lane's header reads LIVE: the floor is quiet." : "",
    parts,
    gates: gateRows.map((g) => ({ key: g.key, name: g.name, roomName: g.roomName, room: g.room, canOpen: g.canOpen })),
    isGatesEmpty: gateRows.length === 0,
    modes: notServed(
      "Gate modes and the profile",
      "/api/gates",
      "What each gate is set to today -- blocking, advisory or off -- and the strictness profile that switches the whole set as one, parsed from the gates file.",
    ),
    profileVerb: verbPending(
      "Switch the profile",
      "One key switches every gate as a set, with a reason written down; loosening is a profile switch, never a flag somebody remembers. It arrives with the work door.",
    ),
  };
}
