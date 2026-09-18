// fold.mjs -- money/discover: every decision the discover room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1328).
//
// The port of v0.7's Discover, a PLANNED room. v0.7 rehearsed a hunt, a score and a shortlist against a local
// workspace; the discover lane is not born, so its planned line comes from the planned-rooms registry, dotted,
// and each flow is a REHEARSAL card that writes nothing. The next venture is chosen by the council and your
// stamp once the lane exists -- nothing here convenes one.
import { rehearsal } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { plannedFigure, plannedRoom } from "../../../lib/planned-room.mjs";

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
      "Capture a pain",
      "idea.captured, then normalised and de-duplicated: a pain in the customer's own words, refused at capture when it repeats one already held. Rehearsed; the discover lane is not born.",
    ),
    rehearsal(
      "Score it",
      "The scoring file's four numbers, and a pain with too little distribution hard-flagged before it can reach a shortlist. Rehearsed, and no score is written.",
    ),
    rehearsal(
      "Send the top two to council",
      "The shortlist is exactly two; the council debates them and you stamp one, and the one-pager comes before a separate venture kickoff. No council is convened from here.",
    ),
  ];
  return {
    ...base,
    kpis: [
      plannedFigure(base, "stations", "Stations on the planned line", base.line.length, "planned-rooms.json · none has run"),
      { key: "flows", v: fmtInt(flows.length), l: "Flows rehearsed here", sub: "each says REHEARSAL · none writes" },
      plannedFigure(base, "today", "Already in the repo", base.showsToday.length, "what the unborn lane can point at"),
      { key: "kinds", v: fmtInt(base.kinds.length), l: "Kinds it will own", sub: "company-wide · none counted here" },
    ],
    flows,
    rules: [
      "A pain with too little distribution never reaches the shortlist: it is flagged, not argued with.",
      "A duplicate pain is refused at capture, not merged later.",
      "The shortlist is exactly two. The council debates them; you stamp one.",
      "A kickoff is a separate venture: its own repo and its own kill criteria, with the one-pager first.",
    ],
  };
}
