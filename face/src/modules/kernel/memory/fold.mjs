// fold.mjs -- kernel/memory: every decision the memory room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Memory onto the door. What is real: the memory lane's header, and the path, hash and
// size of the retro log and the trial ledger. What is not served: the lesson registry, the promoted rules
// and the recall cost, which /api/memory will fold from those files. Logging a correction, running a
// recall and proposing a rule are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { holdsCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   lessons: import("../../../lib/registry.mjs").NotServed,
 *   logVerb: { isVerbPending: true, verb: string, sentence: string },
 *   recallVerb: { isVerbPending: true, verb: string, sentence: string },
 *   recallCost: import("../../../lib/registry.mjs").NotServed,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, {
    files: ["retro-log", "trial-ledger"],
    trailEmpty: "The registry homes no receipt kind here. A lesson is a retro-log row, and a rule it becomes is a reviewed diff.",
  });
  const logged = base.sources.find((s) => s.id === "retro-log");
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "retro", v: logged !== undefined && logged.isRead ? logged.size : "—", l: "The retro log", sub: "its size, as the door serves it" },
      { key: "concepts", v: holdsCount(base, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "cost", v: "—", l: "Recall cost", sub: "not served yet" },
    ],
    lessons: notServed(
      "Lessons",
      "/api/memory",
      "Every lesson with the number of times it was corrected, the ones already promoted to rules, and the ones proposable now, folded from the retro log.",
    ),
    logVerb: verbPending(
      "Log a correction",
      "A correction is counted against its earlier repeats by its normalized text; the second one makes it proposable as a rule. Logging arrives with the work door.",
    ),
    recallVerb: verbPending(
      "Recall",
      "How did we get burned by this before: a fold over the lessons, the trial ledger and the receipts, with no model and no spend. It runs through the work door.",
    ),
    recallCost: notServed(
      "Recall cost",
      "/api/memory",
      "What one recall costs today, measured by the recall golden gate rather than estimated.",
    ),
  };
}
