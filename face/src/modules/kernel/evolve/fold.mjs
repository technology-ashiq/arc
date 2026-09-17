// fold.mjs -- kernel/evolve: every decision the evolve room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Evolve onto the door. What is real: the evolve lane's header and the experiment
// receipts the registry homes here, counted by kind. What is not served: the experiments themselves --
// each surface, its arms against the sample floor, its verdict -- and the experiment contract, which
// /api/evolve will fold. Opening, measuring and concluding are work-door verbs (Phase 05). The reference's
// batches were simulated; none is drawn here, simulated or otherwise.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   experiments: import("../../../lib/registry.mjs").NotServed,
 *   openVerb: { isVerbPending: true, verb: string, sentence: string },
 *   contract: import("../../../lib/registry.mjs").NotServed,
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
      { key: "opened", v: kindCount(base, "experiment.opened"), l: "Experiments opened", sub: "experiment.opened" },
      { key: "measured", v: kindCount(base, "experiment.measured"), l: "Batches measured", sub: "experiment.measured" },
      { key: "promoted", v: kindCount(base, "experiment.promoted"), l: "Promoted", sub: "landed on your stamp" },
      { key: "rolled", v: kindCount(base, "experiment.rolled_back"), l: "Rolled back", sub: "experiment.rolled_back" },
    ],
    experiments: notServed(
      "Experiments",
      "/api/evolve",
      "Each experiment's declared surface, metric and hypothesis, both arms against the sample floor, the holdout, and the verdict once both arms reach the floor, folded from its receipts.",
    ),
    openVerb: verbPending(
      "Open an experiment",
      "One declared surface, one metric, one hypothesis, written before the first batch. Opening, measuring and concluding arrive with the work door.",
    ),
    contract: notServed(
      "Experiment contract",
      "/api/evolve",
      "The evolve section of a process manifest: its surface, metric, sample floor and holdout, as the manifest declares them.",
    ),
  };
}
