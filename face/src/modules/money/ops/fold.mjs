// fold.mjs -- money/ops: every decision the ops room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1328).
//
// The port of v0.7's Ops, a PLANNED room. v0.7 rehearsed incidents, a support file-drop and a weekly report
// against a local workspace; the face has no second store and the ops lane is not born, so the room draws its
// planned line from the planned-rooms registry, dotted, and each of v0.7's flows is a REHEARSAL card that
// writes nothing. Nothing here says LIVE (F3): the badge is fixed and the kinds it will own are the company's.
import { rehearsal } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { plannedFigure, plannedKinds, plannedRoom } from "../../../lib/planned-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/planned-room.mjs").PlannedRoom & {
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   flows: { isRehearsal: true, verb: string, sentence: string }[],
 *   rules: string[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = plannedRoom(payloads, ctx);
  const flows = [
    rehearsal(
      "Raise an incident",
      "incident.raised, then an acknowledgement, then a resolution typed by a person -- an incident is open until someone closes it in words. Rehearsed: the ops lane is not born, so nothing is raised.",
    ),
    rehearsal(
      "Drop a support file",
      "A dropped message is classified, a template reply is drafted, and your stamp seals it for a person to send. The machine drafts; a person sends. Rehearsed, and never sent.",
    ),
    rehearsal(
      "Write the weekly ops report",
      "One report a week and a drill, once two ventures are live and support stops being one person. Until then it is rehearsed, and no report is written.",
    ),
  ];
  return {
    ...base,
    kpis: [
      plannedFigure(base, "stations", "Stations on the planned line", "line", "planned-rooms.json · none has run"),
      { key: "flows", v: fmtInt(flows.length), l: "Flows rehearsed here", sub: "each says REHEARSAL · none writes" },
      plannedFigure(base, "today", "Already in the repo", "showsToday", "what the unborn lane can point at"),
      plannedKinds(base),
    ],
    flows,
    rules: [
      "The machine drafts and a person sends: a seal is a copy for a person, never a send button.",
      "A refund is a person's decision, always; no template offers one.",
      "An incident stays open until a typed resolution closes it. Nothing resolves itself.",
      "The room is born when a second venture is live. Until then everything here is REHEARSAL.",
    ],
  };
}
