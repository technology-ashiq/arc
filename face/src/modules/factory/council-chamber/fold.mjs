// fold.mjs -- factory/council-chamber: every decision the council room makes, where node can import it
// with no install (face v2 Phase 03, ADR-1320, ADR-1322, ADR-1324, ADR-1326).
//
// The port of v0.7's Council onto the door. What is real: the council receipts the registry homes here,
// counted by kind and drawn as a trail, and the twelve seats -- which are the agents the served registry
// homes in this room, not a list typed here. What is not served: the verdict ledger (each verdict with
// its points, its dissent and its review-by date) and the calibration number scored from HIT/MISS, both
// of which /api/council will fold. Convening a council and scoring a call are work-door verbs (Phase 05).
//
// ADR-1322: the council renders in the accent and dim, and violet stays the non-real class -- no seat,
// verdict or score wears a reserved colour here.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   convene: { isVerbPending: true, verb: string, sentence: string },
 *   ledger: import("../../../lib/registry.mjs").NotServed,
 *   calibration: import("../../../lib/registry.mjs").NotServed,
 *   seats: { key: string, name: string }[],
 *   hasSeats: boolean,
 *   seatsNote: string,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const seats = (base.held.agents ?? []).map((name) => ({ key: name, name }));
  return {
    ...base,
    badge: laneBadge(base, `${seats.length === 0 ? "no" : seats.length} seats · a company organ, not a lane`),
    kpis: [
      { key: "seats", v: holdsCount(base, "agents"), l: "Seats", sub: "the agents the registry homes here" },
      { key: "verdicts", v: kindCount(base, "council.verdict"), l: "Verdicts", sub: countedOn(base, "council.verdict") },
      { key: "outcomes", v: kindCount(base, "council.outcome"), l: "Outcomes scored", sub: countedOn(base, "council.outcome") },
      { key: "decisions", v: kindCount(base, "decision.recorded"), l: "Decisions recorded", sub: countedOn(base, "decision.recorded") },
    ],
    convene: verbPending(
      "Convene the council",
      "Seats argue blind and in parallel, a verifier grades every point, one bounded rebuttal follows, and the verdict commits with its dissent. Convening arrives with the work door.",
    ),
    ledger: notServed(
      "The verdict ledger",
      "/api/council",
      "Each verdict with the points behind it, the dissent it committed with, and the review-by date on which it is scored HIT or MISS.",
    ),
    calibration: notServed(
      "Calibration",
      "/api/council",
      "The measured calibration of the calls this company has made: hits against misses, scored on the review-by date rather than claimed.",
    ),
    seats,
    hasSeats: seats.length > 0,
    seatsNote: seats.length === 0 ? "the served registry homes no agent in this room" : "",
  };
}
