// fold.mjs -- kernel/model-policy: every decision the model-policy room makes, where node can import it
// with no install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's ModelPolicy onto the door. What is real: the model-policy lane's header and the
// router file's path and hash. What is not served: the tier table, the process routes and the egress
// allowlist, which /api/model-policy will parse from that file. Proposing a tier is a verb of the work
// door (Phase 05); until then the room says so instead of drawing a button that writes nothing.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { holdsCount, laneBadge, laneKpi, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   tiers: import("../../../lib/registry.mjs").NotServed,
 *   routesTable: import("../../../lib/registry.mjs").NotServed,
 *   propose: { isVerbPending: true, verb: string, sentence: string },
 *   egress: import("../../../lib/registry.mjs").NotServed,
 *   bench: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, {
    files: ["router"],
    trailEmpty: "The registry homes no receipt kind here. A tier change is a reviewed diff to the router file, and the merge that lands it is its record.",
  });
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "concepts", v: holdsCount(ctx, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "tiers", v: "—", l: "Tiers", sub: "not served yet" },
      { key: "routes", v: "—", l: "Process routes", sub: "not served yet" },
    ],
    tiers: notServed(
      "The tier table",
      "/api/model-policy",
      "Each tier as a job description first and the model that implements it second, parsed from the tier block of engine/router.yaml.",
    ),
    routesTable: notServed(
      "Process routes",
      "/api/model-policy",
      "Every process class with its tier, its driver and fallback chain, and a contractor's cap, judge and review-by date, parsed from engine/router.yaml.",
    ),
    propose: verbPending(
      "Propose a tier change",
      "A tier change is a reviewed diff to the router file citing ADR-0069, raised to your inbox for a stamp; the route keeps its tier until you stamp. The face raises it once the work door exists.",
    ),
    egress: notServed(
      "Egress allowlist",
      "/api/model-policy",
      "The exact host and port each driver may reach, parsed from the router file's egress block.",
    ),
    bench: roomLink(ctx, "bench"),
  };
}
