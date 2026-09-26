// fold.mjs -- factory/design-studio: every decision the design studio makes, where node can import it
// with no install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Design Studio onto the door. What is real: the design lane's header and phase
// specs, and the receipts the registry homes here, counted by kind. What is not served: the studio floor
// -- each submitted surface, its three explore variants and their theses, the critique's findings and
// the blind jury's ranking -- which /api/design will fold from the critique artifacts. Submitting a
// surface, running a critique and convening a jury are work-door verbs (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   floor: import("../../../lib/registry.mjs").NotServed,
 *   critiqueVerb: { isVerbPending: true, verb: string, sentence: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "reviews", v: kindCount(base, "review.completed"), l: "Reviews", sub: countedOn(base, "review.completed") },
      { key: "decisions", v: kindCount(base, "decision.recorded"), l: "Decisions recorded", sub: countedOn(base, "decision.recorded") },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints", sub: "homed here by the registry" },
    ],
    floor: notServed(
      "The studio floor",
      "/api/design",
      "Each submitted surface with its three explore variants and their theses, the read-only critique's findings by class, and the blind jury's ranking against a reference item. The design lane counts these in bash scripts and its lint cannot be imported, so no parser exists for the door to use -- filed to the design lane.",
    ),
    critiqueVerb: verbPending(
      "Run a critique, or convene the jury",
      "The critique is read-only and may fail work for insufficiency, not only for breaking a rule; the jury ranks blind, with a reference item it is not told about. Both arrive with the work door.",
    ),
  };
}
