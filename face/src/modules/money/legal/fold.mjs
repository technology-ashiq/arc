// fold.mjs -- money/legal: every decision the legal room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Legal onto the door. What is real: the legal lane's header, the receipts the registry homes
// here, the lints and products it says the room holds, and the constitution's provenance -- the file the five
// seals are written in. Through the door (Phase 04): the gates' declared modes from /api/gates (the same table
// review-and-ship draws), and from /api/legal the seals as the constitution states them -- each against the
// policy file's element-for-element quote, the lane's own check -- and the pieces held at the publish gate with
// your stamp on each. What is still NOT SERVED: the legal lane's hash chain, which only its verify run computes,
// against a fresh render and a published directory in each venture's own repo. Changing a gate's mode, running the
// legal lints and stamping the full-read gate are verbs of the work door (Phase 05) -- and a gate's mode is a
// reviewed diff there, never an agent's action.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { field, gateModes, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   gates: import("../../../lib/served.mjs").ServedTable,
 *   publishGate: import("../../../lib/served.mjs").ServedTable,
 *   seals: import("../../../lib/served.mjs").ServedTable,
 *   chain: import("../../../lib/registry.mjs").NotServed,
 *   modeVerb: { isVerbPending: true, verb: string, sentence: string },
 *   lintVerb: { isVerbPending: true, verb: string, sentence: string },
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
  const gatesSt = servedRead(payloads, ctx, base.reads, "/api/gates");
  const st = servedRead(payloads, ctx, base.reads, "/api/legal");
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "notes", v: kindCount(base, "note.logged"), l: "Notes logged", sub: countedOn(base, "note.logged") },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints and gates held", sub: "the served registry's list" },
      { key: "products", v: holdsCount(base, "products"), l: "Products it guards", sub: "the served registry's list" },
    ],
    gates: gateModes(gatesSt, "The gates", "a mode changes only by a reviewed diff to arc.gates.yaml"),
    publishGate: servedTable(st, {
      panel: "The publish gate",
      route: "/api/legal",
      columns: ["piece", "held since", "your stamp", "sha pinned"],
      listKey: "publishGate",
      empty: "Nothing is held at the publish gate: no legal.publish approval is on this spine.",
      row: (g) => {
        const id = field(g, "id");
        const state = field(g, "state");
        return id === "" ? null : { key: id, cells: [field(g, "what") || id, field(g, "ts").slice(0, 16), state === "open" ? "waiting on you" : state, field(g, "sha").slice(0, 12) || "none named"] };
      },
      note: "the legal lints' results are written to each venture's own run file, which the door does not read",
    }),
    seals: servedTable(st, {
      panel: "The seals",
      route: "/api/legal",
      columns: ["the seal, as the constitution states it", "quoted in hq.policy.yaml"],
      listKey: "seals",
      empty: "The constitution's E2 clause parsed to no seal.",
      row: (x) => {
        const seal = field(x, "seal");
        return seal === "" ? null : { key: seal, cells: [seal, x["quoted"] === true ? "yes, element for element" : "NO -- the quote drifted"] };
      },
      note: st.isRead
        ? (st.body["quoteHolds"] === true
          ? "the policy lane's check holds: hq.policy.yaml quotes E2 element for element, so no grant can name a seal"
          : `the policy lane's check FAILS: ${field(st.body, "quoteProblem")}`)
        : "",
    }),
    chain: notServed(
      "Hash chain",
      "/api/legal",
      "The legal lane's verification chain: how many receipts it covers and whether it is intact, from the lane's own verify run -- append-only, a correction supersedes, a closed day never changes. That run needs a fresh render and the published directory in each venture's own repo, so the door cannot compute it -- filed to the legal lane.",
    ),
    modeVerb: verbPending(
      "Change a gate's mode",
      "A gate's mode changes by a reviewed diff to arc.gates.yaml -- never an agent's action -- and the change is a receipt. It arrives with the work door.",
    ),
    lintVerb: verbPending(
      "Run the legal lints",
      "The publish gate, claims that need a source, the PII tripwire and the hash-chain verify, each result landing as a receipt. It arrives with the work door.",
    ),
    // "Stamp the full-read gate" is LIVE since face v2 Phase 05 (ADR-1344): the work door's legal.full-read op raises
    // the question, and the stamp is the decision in the inbox room. Its card is retired.
    whoMay: [
      "gate modes -- a reviewed repo diff, never an agent's action",
      "autonomy ceilings -- declared by a person, never by a process",
      "the constitution -- only its owner, after a cooling period",
      "a machine may cite the law and flag tension with it -- never amend it",
    ],
  };
}
