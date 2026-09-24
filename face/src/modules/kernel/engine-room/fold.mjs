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
import { keyLeakSentence, withholdKeys } from "../../../lib/keys.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   drivers: import("../../../lib/served.mjs").ServedTable,
 *   driversOnDisk: import("../../../lib/served.mjs").ServedTable,
 *   budgets: import("../../../lib/served.mjs").ServedTable,
 *   runs: import("../../../lib/lane-room.mjs").RunRow[],
 *   health: import("../../../lib/lane-room.mjs").RunRow[],
 *   hasHealth: boolean,
 *   showHealthEmpty: boolean,
 *   healthNote: string,
 *   keyLeaks: string[],
 *   hasKeyLeak: boolean,
 *   keyLeakText: string,
 *   hasRuns: boolean,
 *   showRunsEmpty: boolean,
 *   ask: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} raw
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(raw, ctx) {
  // ADR-1325: the room folds its payloads with every key withheld, and names the reads that carried one. The read host
  // (registry.mjs foldModule) withholds first; this pass reports what it withheld, and holds when the fold is called
  // on its own (attack 57d014d B4: the banner alone left the key drawn in the rows under it).
  const { payloads, leaks } = withholdKeys(raw);
  const base = laneRoom(payloads, ctx, { files: ["router"] });
  const runsHomed = hasKind(base, "run.completed");
  const runs = runsHomed ? runsBy(base.trail.events, "process", ["driver", "model", "duration_ms"], base.trail.isPartial) : [];
  // Phase 06 (REQ-08): each DRIVER's health, from the same receipts -- how many runs it carried, how the last one ended,
  // when, and on which model. A measurement of what ran, never a probe of the provider.
  // On a PARTIAL page (the door pages oldest-first) a driver's last run on the page is not its current health: the row
  // says so, never a bare "last ok" (attack 57d014d B8).
  // ONE predicate for "names a driver": visible text. Blank, whitespace-only and zero-width names are no name -- the
  // rows and the unnamed count use the same test, so a receipt is in exactly one of them (round-2 attack 4010c52 B9).
  const INVISIBLE = new RegExp(`[\\s${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200d)}${String.fromCharCode(0x2060, 0xfeff)}]`, "g");
  const named = (/** @type {unknown} */ v) => typeof v === "string" && v.replace(INVISIBLE, "") !== "";
  const health = (runsHomed ? runsBy(base.trail.events, "driver", ["model", "process"], base.trail.isPartial) : [])
    .filter((r) => named(r.name))
    .map((r) => (base.trail.isPartial ? { ...r, last: r.last.replace(/^last /, "last on this page: ") } : r));
  // Receipts that name no driver are counted and said, never dropped from the health they would change (B9).
  const unnamed = runsHomed ? base.trail.events.filter((e) => e.kind === "run.completed" && !named(e.payload["driver"])).length : 0;
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
    health,
    hasHealth: health.length > 0,
    showHealthEmpty: runsHomed && base.trail.isDrawn && health.length === 0,
    healthNote: unnamed === 0 ? "" : `${unnamed} run receipt${unnamed === 1 ? "" : "s"} on this page name${unnamed === 1 ? "s" : ""} no driver, and ${unnamed === 1 ? "is" : "are"} not in the rows above`,
    keyLeaks: leaks,
    hasKeyLeak: leaks.length > 0,
    keyLeakText: keyLeakSentence(leaks),
    showRunsEmpty: runsHomed && base.trail.isDrawn && runs.length === 0,
    ask: roomLink(ctx, "ask-arc"),
  };
}
