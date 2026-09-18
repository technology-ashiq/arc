// fold.mjs -- kernel/engine-room: every decision the engine room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1325).
//
// The port of v0.7's EngineRoom onto the door. What is real: the engine lane's header, the run.completed
// receipts grouped by the process that ran, the router file's path and hash, and -- through /api/engine
// (Phase 04) -- the drivers on disk, the router row for every task class with its tenure terms, and the
// bench's capped budgets, each parsed by the engine lane's own readers. The reference's key field is not
// ported and never will be: no provider key lives in the browser (ADR-1325).
import { asArray, asObject, cell, field, projected, refusedPart, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, hasKind, holdsCount, kindCount, laneBadge, laneKpi, laneRoom, roomLink, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   drivers: import("../../../lib/served.mjs").ServedTable,
 *   driversOnDisk: import("../../../lib/served.mjs").ServedTable,
 *   budgets: import("../../../lib/served.mjs").ServedTable,
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
  const runsHomed = hasKind(base, "run.completed");
  const runs = runsHomed ? runsBy(base.trail.events, "process", ["driver", "model", "duration_ms"], base.trail.isPartial) : [];
  const st = servedRead(payloads, ctx, base.reads, "/api/engine");
  const faults = asArray(st.body["faults"]).map(cell).filter((f) => f !== "");
  const budgetBody = asObject(st.body["budgets"]);
  const budgetSt = st.isRead && st.body["budgets"] === null
    ? refusedPart(st, "BUDGETS_UNREAD", field(st.body, "budgetsRefused") || "the door read no budget file")
    : projected(st, "rows", (b) => asObject(b["budgets"])["rows"]);
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "runs", v: kindCount(base, "run.completed"), l: "Runs completed", sub: countedOn(base, "run.completed") },
      { key: "processes", v: holdsCount(base, "processes"), l: "Processes", sub: "homed here by the registry" },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints", sub: "homed here by the registry" },
    ],
    drivers: servedTable(st, {
      panel: "Drivers, routers and budgets",
      route: "/api/engine",
      columns: ["task class", "tier", "driver, then fallback", "terms"],
      listKey: "classes",
      empty: "engine/router.yaml routes no task class.",
      row: (c) => {
        const name = field(c, "name");
        const chain = [field(c, "driver"), ...asArray(c["fallback"]).map(cell)].filter((d) => d !== "").join(" → ");
        const terms = field(c, "cap") === "" ? "no hire terms"
          : `${field(c, "cap")} · ${field(c, "hosted")} · judged by ${field(c, "judge")} · review by ${field(c, "review_by")}${c["expired"] === true ? " · EXPIRED" : ""}`;
        return name === "" ? null : { key: name, cells: [name, field(c, "tier"), chain, terms] };
      },
      note: faults.length === 0 ? "" : `the router loader reports ${faults.length} fault${faults.length === 1 ? "" : "s"}: ${faults.join(" · ")}`,
    }),
    driversOnDisk: servedTable(projected(st, "drivers", (b) => (Array.isArray(b["drivers"]) ? b["drivers"].map((d) => ({ name: d })) : undefined)), {
      panel: "Drivers on disk",
      route: "/api/engine",
      columns: [],
      listKey: "drivers",
      empty: "No driver script ships under .claude/scripts/engine/drivers.",
      row: (d) => (field(d, "name") === "" ? null : { key: field(d, "name"), cells: [field(d, "name")] }),
    }),
    budgets: servedTable(budgetSt, {
      panel: "Budgets",
      route: "/api/engine",
      columns: ["driver", "model", "worst case per call"],
      listKey: "rows",
      empty: "The ceiling file names no driver and model pair, so the bench admits none.",
      row: (b) => {
        const key = `${field(b, "driver")}/${field(b, "model")}`;
        return key === "/" ? null : { key, cells: [field(b, "driver"), field(b, "model"), `₹${cell(b["worst_case_inr"])}`] };
      },
      note: budgetSt.isRead
        ? `a run is capped at ₹${cell(budgetBody["run_cap_inr"])} and one process at ₹${cell(budgetBody["process_cap_inr"])}, K=${cell(budgetBody["k"])}, as of ${field(budgetBody, "as_of")} -- a ceiling bounds spend and never reports it`
        : "",
    }),
    runs,
    hasRuns: runs.length > 0,
    showRunsEmpty: runsHomed && base.trail.isDrawn && runs.length === 0,
    ask: roomLink(ctx, "ask-arc"),
  };
}
