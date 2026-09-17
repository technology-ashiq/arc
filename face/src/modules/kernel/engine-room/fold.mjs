// fold.mjs -- kernel/engine-room: every decision the engine room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1325).
//
// The port of v0.7's EngineRoom onto the door. What is real: the engine lane's header, the run.completed
// receipts grouped by the process that ran, and the router file's path and hash. What is not served: the
// driver table, the router rows and the budgets, which /api/engine will parse from that file. The
// reference's key field is not ported and never will be: no provider key lives in the browser (ADR-1325).
import { notServed } from "../../../lib/registry.mjs";
import { holdsCount, kindCount, laneBadge, laneKpi, laneRoom, roomLink, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   drivers: import("../../../lib/registry.mjs").NotServed,
 *   runs: import("../../../lib/lane-room.mjs").RunRow[],
 *   hasRuns: boolean,
 *   showRunsEmpty: boolean,
 *   ask: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["router"] });
  const runs = runsBy(base.trail.events, "process", ["driver", "model", "duration_ms"]);
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "runs", v: kindCount(base, "run.completed"), l: "Runs completed", sub: "run.completed on the spine" },
      { key: "processes", v: holdsCount(ctx, "processes"), l: "Processes", sub: "homed here by the registry" },
      { key: "lints", v: holdsCount(ctx, "lints"), l: "Lints", sub: "homed here by the registry" },
    ],
    drivers: notServed(
      "Drivers, routers and budgets",
      "/api/engine",
      "The driver table, the router row for every task class, and each capped budget, parsed from engine/router.yaml. The door serves that file as text today; its parsed table arrives with this route.",
    ),
    runs,
    hasRuns: runs.length > 0,
    showRunsEmpty: base.trail.isDrawn && runs.length === 0,
    ask: roomLink(ctx, "ask-arc"),
  };
}
