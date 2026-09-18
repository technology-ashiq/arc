// fold.mjs -- money/legal: every decision the legal room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Legal onto the door. What is real: the legal lane's header, the receipts the registry homes
// here, the lints and products it says the room holds, and the constitution's provenance -- the file the five
// seals are written in. What is not served: the gates' modes (the same arc.gates.yaml table /api/gates will fold
// for review-and-ship), the pieces held at the publish gate, the five seals as the constitution states them and
// the legal lane's hash chain, which /api/legal will fold. Changing a gate's mode, running the legal lints and
// stamping the full-read gate are verbs of the work door (Phase 05) -- and a gate's mode is a reviewed diff there,
// never an agent's action.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   gates: import("../../../lib/registry.mjs").NotServed,
 *   publishGate: import("../../../lib/registry.mjs").NotServed,
 *   seals: import("../../../lib/registry.mjs").NotServed,
 *   chain: import("../../../lib/registry.mjs").NotServed,
 *   modeVerb: { isVerbPending: true, verb: string, sentence: string },
 *   lintVerb: { isVerbPending: true, verb: string, sentence: string },
 *   stampVerb: { isVerbPending: true, verb: string, sentence: string },
 *   whoMay: string[],
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["constitution"] });
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "notes", v: kindCount(base, "note.logged"), l: "Notes logged", sub: countedOn(base, "note.logged") },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints and gates held", sub: "the served registry's list" },
      { key: "products", v: holdsCount(base, "products"), l: "Products it guards", sub: "the served registry's list" },
    ],
    gates: notServed(
      "The gates",
      "/api/gates",
      "Every enforcement gate with its mode -- block, warn, profile or off -- its tier and its evidence, parsed from arc.gates.yaml, where a mode changes only by a reviewed diff.",
    ),
    publishGate: notServed(
      "The publish gate",
      "/api/legal",
      "The pieces held between draft and the internet right now -- awaiting a review pack, or approved with their sha pinned and awaiting a person's merge -- with the legal lints' results beside each.",
    ),
    seals: notServed(
      "The five seals",
      "/api/legal",
      "The actions no level of proven autonomy ever includes, as the constitution states them -- moving money, killing a venture, changing a price, unlocking real-money trading, publishing under the owner's name.",
    ),
    chain: notServed(
      "Hash chain",
      "/api/legal",
      "The legal lane's verification chain: how many receipts it covers and whether it is intact, from the lane's own verify run -- append-only, a correction supersedes, a closed day never changes.",
    ),
    modeVerb: verbPending(
      "Change a gate's mode",
      "A gate's mode changes by a reviewed diff to arc.gates.yaml -- never an agent's action -- and the change is a receipt. It arrives with the work door.",
    ),
    lintVerb: verbPending(
      "Run the legal lints",
      "The publish gate, claims that need a source, the PII tripwire and the hash-chain verify, each result landing as a receipt. It arrives with the work door.",
    ),
    stampVerb: verbPending(
      "Stamp the full-read gate",
      "Nothing ships under the owner's name until a person has read it in full and stamped it; the stamp is the gate. It arrives with the work door.",
    ),
    whoMay: [
      "gate modes -- a reviewed repo diff, never an agent's action",
      "autonomy ceilings -- declared by a person, never by a process",
      "the constitution -- only its owner, after a cooling period",
      "a machine may cite the law and flag tension with it -- never amend it",
    ],
  };
}
