// fold.mjs -- factory/develop: every decision the develop room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Develop onto the door. What is real: the develop lane's header and its phase specs
// by number, and the slice receipts the registry homes here, counted by kind and drawn as a trail. What
// is not served: the slices themselves -- each with its proof tier, its result and the commit it landed
// on -- and the computed Definition of Done a close is measured against, which /api/slices will fold.
// Opening a slice, recording a proof and closing a phase are work-door verbs (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   slices: import("../../../lib/registry.mjs").NotServed,
 *   dod: import("../../../lib/registry.mjs").NotServed,
 *   openVerb: { isVerbPending: true, verb: string, sentence: string },
 *   closeVerb: { isVerbPending: true, verb: string, sentence: string },
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
      { key: "done", v: kindCount(base, "slice.done"), l: "Slices proven", sub: countedOn(base, "slice.done") },
      { key: "stuck", v: kindCount(base, "slice.stuck"), l: "Slices stuck", sub: countedOn(base, "slice.stuck") },
      { key: "started", v: kindCount(base, "develop.started"), l: "Harness starts", sub: countedOn(base, "develop.started") },
      { key: "handoff", v: kindCount(base, "handoff.ready"), l: "Handoffs ready", sub: countedOn(base, "handoff.ready") },
    ],
    slices: notServed(
      "Slices",
      "/api/slices",
      "Each slice of the live phase with its proof tier, the output that proved it and the commit it landed on, as the phase's task file records them.",
    ),
    dod: notServed(
      "The Definition of Done",
      "/api/slices",
      "The close condition computed rather than asserted: every slice proven, tests green on CI, evidence bundled -- and the refusal that names what is missing when it is not.",
    ),
    openVerb: verbPending(
      "Open a slice",
      "A named unit of the live phase, open until it is proven: tests green AND the owner saw it run. Opening and proving arrive with the work door.",
    ),
    closeVerb: verbPending(
      "Close a phase on evidence",
      "The close is refused unless the Definition of Done computes, and the refusal is itself a receipt that says what is missing. It arrives with the work door.",
    ),
  };
}
