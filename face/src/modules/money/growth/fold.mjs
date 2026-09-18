// fold.mjs -- money/growth: every decision the growth room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Growth onto the door. What is real: the growth lane's header, the content.published and
// metric.observed receipts the registry homes here, the published pieces counted by the channel each receipt
// names (v0.7's channel scoreboard, from the log rather than from a typed channel list), and the lints the
// registry says are on duty. What is not served: the pipeline -- every piece from draft to review pack to
// published -- which /api/growth will fold. Drafting, sending the review pack and publishing are verbs of the
// work door (Phase 05); publishing under the owner's name stays a person's act for ever.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedBy, countedOn, hasKind, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   draftVerb: { isVerbPending: true, verb: string, sentence: string },
 *   packVerb: { isVerbPending: true, verb: string, sentence: string },
 *   publishVerb: { isVerbPending: true, verb: string, sentence: string },
 *   pipeline: import("../../../lib/registry.mjs").NotServed,
 *   channels: import("../../../lib/lane-room.mjs").CountRow[],
 *   showChannelsEmpty: boolean,
 *   channelsEmpty: string,
 *   lints: string[],
 *   showLintsEmpty: boolean,
 *   gates: { key: string, name: string, line: string }[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const publishedHomed = hasKind(base, "content.published");
  const channels = publishedHomed && base.trail.isDrawn ? countedBy(base.trail.events, "content.published", "channel", base.trail.isPartial) : [];
  const lints = base.held.lints ?? [];
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "published", v: kindCount(base, "content.published"), l: "Pieces published", sub: countedOn(base, "content.published") },
      { key: "observed", v: kindCount(base, "metric.observed"), l: "Metrics observed", sub: countedOn(base, "metric.observed") },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints on duty", sub: "the served registry's list" },
    ],
    draftVerb: verbPending(
      "Draft a piece",
      "content.drafted, with the slop lint run as you type: it catches bad patterns and never prescribes a style. It arrives with the work door.",
    ),
    packVerb: verbPending(
      "Send the review pack to your inbox",
      "Gate one: one inbox item bundling the preview, the lint results and the diff; your stamp pins the draft's sha. It arrives with the work door.",
    ),
    publishVerb: verbPending(
      "Merge and publish",
      "Gate two: a person merges, and content.published carries the sha read from the merged tree -- unedited means the approved sha and the published sha match. The machine writes the branch; it never merges.",
    ),
    pipeline: notServed(
      "The pipeline",
      "/api/growth",
      "Every piece from draft to review pack to published, its status moving only on receipts, with the approved sha beside the published one.",
    ),
    channels,
    showChannelsEmpty: publishedHomed && base.trail.isDrawn && channels.length === 0,
    channelsEmpty: "No content.published receipt on the page the door sent names a channel. A channel that has never published has no receipt, so it is not listed as a zero.",
    lints,
    showLintsEmpty: lints.length === 0,
    gates: [
      { key: "gate-1", name: "gate 1 -- the review pack", line: "one inbox item bundling the preview, the lints and the diff. Your stamp pins the draft's sha." },
      { key: "gate-2", name: "gate 2 -- the merge", line: "a person merges; content.published carries the sha read from the merged tree. Unedited means the two shas match." },
    ],
  };
}
