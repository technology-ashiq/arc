// fold.mjs -- kernel/absorb: every decision the absorb room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Absorb onto the door. What is real: the absorb lane's header and the decision
// receipts the registry homes here -- every decision.recorded, which the room says, because that kind is
// not intake's alone. What is not served: the technique registry and the adopted-per-lane cap, which
// /api/absorb will fold. Capturing, advancing, adopting and retiring are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   captureVerb: { isVerbPending: true, verb: string, sentence: string },
 *   registry: import("../../../lib/registry.mjs").NotServed,
 *   adopted: import("../../../lib/registry.mjs").NotServed,
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
      { key: "decisions", v: kindCount(base, "decision.recorded"), l: "Decisions recorded", sub: "every decision.recorded, not intake's alone" },
      { key: "commands", v: holdsCount(ctx, "commands"), l: "Commands", sub: "homed here by the registry" },
      { key: "lints", v: holdsCount(ctx, "lints"), l: "Lints", sub: "homed here by the registry" },
    ],
    captureVerb: verbPending(
      "Absorb something",
      "A candidate tool, skill, repo or dependency is captured, studied read-only, reported and vetted before anything installs. Capture arrives with the work door.",
    ),
    registry: notServed(
      "The registry",
      "/api/absorb",
      "Every technique arc has looked at, as candidate, trial, adopted or retired, with the report and the blind judgement behind each move.",
    ),
    adopted: notServed(
      "Adopted per lane",
      "/api/absorb",
      "The techniques adopted in each lane, counted against the per-lane cap the registry enforces.",
    ),
  };
}
