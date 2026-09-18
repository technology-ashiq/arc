// fold.mjs -- kernel/evolve: every decision the evolve room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Evolve onto the door. What is real: the evolve lane's header and the experiment
// receipts the registry homes here, counted by kind, and -- through /api/evolve (Phase 04) -- the experiments
// themselves, folded from their receipts by the evolve lane's own board (each surface, its arms counted over
// complete windows, its verdict), and every manifest's declared evolve section, judged by the lint that owns it.
// A hypothesis is not drawn: the experiment.opened grammar carries none. Opening, measuring and concluding are
// work-door verbs (Phase 05). The reference's batches were simulated; none is drawn here, simulated or otherwise.
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   experiments: import("../../../lib/served.mjs").ServedTable,
 *   openVerb: { isVerbPending: true, verb: string, sentence: string },
 *   contract: import("../../../lib/served.mjs").ServedTable,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const st = servedRead(payloads, ctx, base.reads, "/api/evolve");
  const superseded = typeof st.body["superseded"] === "number" ? st.body["superseded"] : 0;
  const manifests = typeof st.body["manifestsRead"] === "number" ? st.body["manifestsRead"] : null;
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "opened", v: kindCount(base, "experiment.opened"), l: "Experiments opened", sub: countedOn(base, "experiment.opened") },
      { key: "measured", v: kindCount(base, "experiment.measured"), l: "Batches measured", sub: countedOn(base, "experiment.measured") },
      { key: "promoted", v: kindCount(base, "experiment.promoted"), l: "Promoted", sub: countedOn(base, "experiment.promoted") },
      { key: "rolled", v: kindCount(base, "experiment.rolled_back"), l: "Rolled back", sub: countedOn(base, "experiment.rolled_back") },
    ],
    experiments: servedTable(st, {
      panel: "Experiments",
      route: "/api/evolve",
      columns: ["experiment", "surface", "units per arm, complete windows", "verdict"],
      listKey: "experiments",
      empty: "No experiment has been opened on this spine.",
      row: (x) => {
        const id = field(x, "id");
        const arms = asArray(x["metrics"]).map((m) => {
          const mm = asObject(m);
          const perArm = asArray(mm["arms"]).map((a) => `${field(asObject(a), "arm")} ${cell(asObject(a)["units"])}`).join(" / ");
          return `${field(mm, "metric")}: ${perArm} (${cell(mm["complete"])} of ${cell(mm["windows"])} windows complete)`;
        });
        const verdict = asObject(x["verdict"]);
        const closed = asObject(x["closed"]);
        const state = field(verdict, "outcome") !== "" ? field(verdict, "outcome") : field(closed, "ts") !== "" ? "closed" : "open";
        return id === "" ? null : { key: id, cells: [id, field(x, "surface"), arms.length > 0 ? arms.join(" · ") : "no measurement yet", state] };
      },
      note: [
        superseded > 0 ? `${superseded} superseded receipt${superseded === 1 ? "" : "s"} set aside by the board's own supersede rule` : "",
        "a hypothesis is not drawn: the experiment.opened grammar does not carry one",
      ].filter((n) => n !== "").join(" · "),
    }),
    openVerb: verbPending(
      "Open an experiment",
      "One declared surface, one metric, one hypothesis, written before the first batch. Opening, measuring and concluding arrive with the work door.",
    ),
    contract: servedTable(st, {
      panel: "Experiment contract",
      route: "/api/evolve",
      columns: ["product", "metrics", "experiments", "the lint's findings"],
      listKey: "contracts",
      empty: manifests === null ? "No product manifest declares an evolve section." : `None of the ${manifests} product manifests declares an evolve section, so no experiment has a contract yet.`,
      row: (c) => {
        const product = field(c, "product");
        const findings = asArray(c["findings"]).map(cell).filter((f) => f !== "");
        return product === "" ? null : { key: product, cells: [product, asArray(c["metrics"]).map(cell).join(", ") || "none", cell(c["experiments"]), findings.length === 0 ? "none -- the section is valid" : findings.join(" · ")] };
      },
    }),
  };
}
