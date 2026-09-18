// fold.mjs -- company/strategy: every decision the strategy room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Strategy onto the door. "One plan is live per lane. The rest are history." The live plans are the
// lanes whose header reads LIVE on the board, each with the cycle its PLAN.md runs; the shelf is every plan and brief
// the served registry homes here, from docs/strategy/plans. What is not served: the ADR index with each decision's
// reversibility -- what is now too expensive to revisit -- which /api/adrs will fold. Adopting a plan and recording an
// ADR are verbs of the work door.
import { notServed, payloadOf, readProblem, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { boardRows } from "../../../lib/spine.mjs";
import { holdsCount, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   board: { isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } },
 *   live: { key: string, lane: string, cycle: string, phase: string, path: string, canOpen: boolean }[],
 *   isLiveEmpty: boolean,
 *   liveEmpty: string,
 *   shelf: { key: string, id: string, path: string }[],
 *   isShelfEmpty: boolean,
 *   shelfEmpty: string,
 *   adrs: import("../../../lib/registry.mjs").NotServed,
 *   expensive: import("../../../lib/registry.mjs").NotServed,
 *   adoptVerb: { isVerbPending: true, verb: string, sentence: string },
 *   recordVerb: { isVerbPending: true, verb: string, sentence: string },
 *   holdsShown: { key: string, label: string, items: string }[],
 *   hasHoldsShown: boolean,
 * }} Folded
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
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
  const live = rows.filter((r) => r.status.tone === "live").map((r, i) => ({
    key: `${i}-${r.lane}`,
    lane: r.lane,
    cycle: r.cycle ?? "no cycle line in its header",
    phase: r.phase.number === null ? "no phase" : `phase ${r.phase.number}`,
    path: `initiatives/${r.lane}/PLAN.md`,
    canOpen: roomLink(ctx, r.lane).canOpen,
  }));
  const plans = base.unreadable.includes("plans") ? null : [...(base.held["plans"] ?? [])].sort();
  const shelf = (plans ?? []).map((id) => ({ key: id, id, path: `docs/strategy/plans/${id}.md` }));
  return {
    ...base,
    reads: [...base.reads, ...reads],
    badge: "one plan live per lane · ADR-0051",
    kpis: [
      { key: "live", v: isBoardRead ? fmtInt(live.length) : "—", l: "Live plans", sub: "a lane whose header reads LIVE" },
      { key: "shelf", v: holdsCount(base, "plans"), l: "Plans and briefs on the shelf", sub: "homed here by the registry" },
      { key: "concepts", v: holdsCount(base, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "adrs", v: "—", l: "Too expensive to revisit", sub: "not served yet · /api/adrs" },
    ],
    board: {
      isReading: boardP.state === "loading" || boardP.state === "pending",
      isRefused: boardP.state === "refused" || (view !== null && !isBoardRead),
      refusal: boardP.state === "refused" ? { code: boardP.code, human: boardP.human } : view !== null && !("rows" in view) ? view : NO_REFUSAL,
    },
    live,
    isLiveEmpty: live.length === 0,
    liveEmpty: isBoardRead ? "No lane's header reads LIVE, so no plan is live." : "",
    shelf,
    isShelfEmpty: shelf.length === 0,
    shelfEmpty: plans === null ? "The served registry carried this room's plans in a shape this shell could not read -- none is drawn, and none is claimed absent." : "The served registry homes no plan here.",
    // The shelf draws the plans; the holds panel lists what else the registry homes here, never the plans twice.
    holdsShown: base.holds.filter((g) => g.key !== "plans"),
    hasHoldsShown: base.holds.some((g) => g.key !== "plans"),
    adrs: notServed(
      "The decision record",
      "/api/adrs",
      "Every ADR by its number and its lane's century, with its status and how reversible it is -- two-way, expensive, or one-way -- read from each file's own header.",
    ),
    expensive: notServed(
      "Too expensive to revisit",
      "/api/adrs",
      "The one-way and expensive decisions, the ones a new plan has to live with rather than reopen, each with the ADR that made it.",
    ),
    adoptVerb: verbPending(
      "Adopt a plan",
      "A plan becomes a lane's live plan at /arc-kickoff, and the lane's previous plan becomes history in the same change; the adoption is a receipt. It arrives with the work door.",
    ),
    recordVerb: verbPending(
      "Record an ADR",
      "An ADR takes the next free number in its lane's century, never the company's highest-plus-one, and lands as a reviewed file. It arrives with the work door.",
    ),
  };
}
