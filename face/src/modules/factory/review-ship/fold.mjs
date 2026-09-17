// fold.mjs -- factory/review-ship: every decision the review-and-ship room makes, where node can import
// it with no install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Review · Ship onto the door. What is real: the review, qa, commit and ship receipts
// the registry homes here, counted by kind and drawn as a trail, and the gates and CI workflows the
// served registry names. What is not served: each gate's MODE -- blocking, advisory or off -- its budget
// and the profile that switches the whole set as one, which /api/gates will parse from arc.gates.yaml.
// Reviewing, running qa and shipping are work-door verbs (Phase 05); the face never claims a gate's
// state it did not read.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   gates: { key: string, name: string }[],
 *   hasGates: boolean,
 *   gatesNote: string,
 *   gateModes: import("../../../lib/registry.mjs").NotServed,
 *   workflows: { key: string, name: string }[],
 *   hasWorkflows: boolean,
 *   workflowsNote: string,
 *   reviewVerb: { isVerbPending: true, verb: string, sentence: string },
 *   shipVerb: { isVerbPending: true, verb: string, sentence: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  // Each gate and each workflow once; a list the registry carried unreadably says so rather than
  // reading as an absence (Phase 03 attack).
  const gatesUnread = base.unreadable.includes("gates");
  const ciUnread = base.unreadable.includes("ci");
  const gates = [...new Set(base.held.gates ?? [])].map((name) => ({ key: name, name }));
  const workflows = [...new Set(base.held.ci ?? [])].map((name) => ({ key: name, name }));
  return {
    ...base,
    badge: laneBadge(base, "every lane passes through here"),
    kpis: [
      { key: "gates", v: holdsCount(base, "gates"), l: "Gates", sub: "named by the served registry" },
      { key: "reviews", v: kindCount(base, "review.completed"), l: "Reviews", sub: countedOn(base, "review.completed") },
      { key: "qa", v: kindCount(base, "qa.completed"), l: "QA runs", sub: countedOn(base, "qa.completed") },
      { key: "commits", v: kindCount(base, "commit.done"), l: "Commits", sub: countedOn(base, "commit.done") },
      { key: "ships", v: kindCount(base, "ship.done"), l: "Ships", sub: countedOn(base, "ship.done") },
    ],
    gates,
    hasGates: gates.length > 0,
    gatesNote: gatesUnread
      ? "the served registry carried this room's gates in a shape this shell could not read"
      : gates.length === 0 ? "the served registry names no gate in this room" : "",
    gateModes: notServed(
      "Gate modes and the profile",
      "/api/gates",
      "What each gate is set to today -- blocking, advisory or off -- the time budget it runs inside, and the strictness profile that switches the whole set as one, parsed from the gates file.",
    ),
    workflows,
    hasWorkflows: workflows.length > 0,
    workflowsNote: ciUnread
      ? "the served registry carried this room's workflows in a shape this shell could not read"
      : workflows.length === 0 ? "the served registry names no CI workflow in this room" : "",
    reviewVerb: verbPending(
      "Review a commit, or run qa",
      "A review is keyed to the commit it read: a new commit is a new review. Running one from here arrives with the work door.",
    ),
    shipVerb: verbPending(
      "Ship",
      "A ship is the last gate passing, not a button that skips the others; loosening any gate asks you to say why, in writing. It arrives with the work door.",
    ),
  };
}
