// fold.mjs -- kernel/policy: every decision the policy room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Policy onto the door. What is real: the policy lane's header, the receipts of the
// kinds the registry homes here, counted by kind, the policy file's path and hash, and -- through /api/policy
// (Phase 04) -- the subject table and the ladder, parsed from hq.policy.yaml by the policy lane's own reader
// and folded by its own reducer. What no lane parses yet is said on the panel: the trial-ledger evidence
// behind a rung. Proposing a cap, demoting a pair and declaring a subject are verbs of the work door (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { countedOn, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";
import { asArray, asObject, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   subjects: import("../../../lib/served.mjs").ServedTable,
 *   capVerb: { isVerbPending: true, verb: string, sentence: string },
 *   declare: { isVerbPending: true, verb: string, sentence: string },
 *   ladder: import("../../../lib/served.mjs").ServedTable,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { files: ["hq-policy"] });
  const st = servedRead(payloads, ctx, base.reads, "/api/policy");
  const caps = asArray(st.body["capabilities"]).map(cell).filter((c) => c !== "");
  const subjects = asArray(st.body["subjects"]).map(asObject);
  /** Every (subject, capability) pair's effective level, read once from the served cells. */
  const effective = subjects.flatMap((s) => asArray(s["cells"]).map((c) => field(asObject(c), "effective")));
  const transitions = typeof st.body["transitions"] === "number" ? st.body["transitions"] : null;
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
    subjects: servedTable(st, {
      panel: "The subject table",
      route: "/api/policy",
      columns: ["subject", ...caps],
      listKey: "subjects",
      empty: "hq.policy.yaml declares no subject.",
      // Each cell is the EFFECTIVE level, with the ceiling beside it only where the event-earned cap holds it lower.
      row: (s) => {
        const name = field(s, "subject");
        const byCap = new Map(asArray(s["cells"]).map((c) => [field(asObject(c), "capability"), asObject(c)]));
        return name === "" ? null : {
          key: name,
          cells: [name, ...caps.map((cap) => {
            const c = byCap.get(cap);
            if (c === undefined) return "—";
            const eff = field(c, "effective");
            const ceil = field(c, "ceiling");
            return eff !== ceil && ceil !== "" ? `${eff} (ceiling ${ceil})` : eff;
          })],
        };
      },
      note: transitions === null ? "" : `effective = the lower of the ceiling in hq.policy.yaml and the cap folded from ${transitions} level-change receipt${transitions === 1 ? "" : "s"} on the spine`,
    }),
    capVerb: verbPending(
      "Propose a cap, or demote a pair",
      "A cap rises only on your stamp, citing trial-ledger evidence; a demotion needs no key at all. Both reach the policy through the work door.",
    ),
    declare: verbPending(
      "Declare a subject",
      "A new subject is a reviewed diff to hq.policy.yaml and is born at the lowest acting level: no row in the policy file, no job.",
    ),
    ladder: servedTable(st, {
      panel: "The ladder",
      route: "/api/policy",
      columns: ["rung", "what it means", "pairs on it"],
      listKey: "levels",
      empty: "hq.policy.yaml declares no level.",
      row: (l) => {
        const level = field(l, "level");
        return level === "" ? null : { key: level, cells: [level, field(l, "meaning"), String(effective.filter((e) => e === level).length)] };
      },
      note: "the trial-ledger evidence that earned a rung is cited on each level-change receipt, and no lane parses it into this table yet",
    }),
  };
}
