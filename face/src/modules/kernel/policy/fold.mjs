// fold.mjs -- kernel/policy: every decision the policy room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Policy onto the door. What is real: the policy lane's header, the receipts of the
// kinds the registry homes here, counted by kind, and the policy file's path and hash. What is not served:
// the subject table and the capability ladder, which /api/policy will parse from hq.policy.yaml. Proposing
// a cap, demoting a pair and declaring a subject are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   subjects: import("../../../lib/registry.mjs").NotServed,
 *   capVerb: { isVerbPending: true, verb: string, sentence: string },
 *   declare: { isVerbPending: true, verb: string, sentence: string },
 *   ladder: import("../../../lib/registry.mjs").NotServed,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["hq-policy"] });
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "changed", v: kindCount(base, "policy.level.changed"), l: "Level changes", sub: countedOn(base, "policy.level.changed") },
      { key: "demoted", v: kindCount(base, "policy.demoted"), l: "Demotions", sub: countedOn(base, "policy.demoted") },
      { key: "reserved", v: kindCount(base, "spend.reserved"), l: "Spend reserved", sub: countedOn(base, "spend.reserved") },
      { key: "released", v: kindCount(base, "spend.released"), l: "Spend released", sub: countedOn(base, "spend.released") },
      { key: "incidents", v: kindCount(base, "incident.raised"), l: "Incidents raised", sub: countedOn(base, "incident.raised") },
    ],
    subjects: notServed(
      "The subject table",
      "/api/policy",
      "One row per subject — each process, and the interactive session — with every capability pair's ceiling, cap and effective level, parsed from hq.policy.yaml.",
    ),
    capVerb: verbPending(
      "Propose a cap, or demote a pair",
      "A cap rises only on your stamp, citing trial-ledger evidence; a demotion needs no key at all. Both reach the policy through the work door.",
    ),
    declare: verbPending(
      "Declare a subject",
      "A new subject is a reviewed diff to hq.policy.yaml and is born at the lowest acting level: no row in the policy file, no job.",
    ),
    ladder: notServed(
      "The ladder",
      "/api/policy",
      "Each capability's rung, from observe to acting with a weekly digest, with the trial-ledger evidence that earned it.",
    ),
  };
}
