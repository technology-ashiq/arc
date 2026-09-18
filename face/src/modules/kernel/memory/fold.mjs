// fold.mjs -- kernel/memory: every decision the memory room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Memory onto the door. What is real: the memory lane's header, and the path, hash and
// size of the retro log and the trial ledger, and -- through /api/memory (Phase 04) -- the lessons themselves,
// read from the retro log by the memory lane's own adapter. What is still NOT SERVED: the recall cost, which no
// gate measures (the golden gate measures hits, not cost). Logging a correction, running a recall and proposing a
// rule are verbs of the work door (Phase 05).
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";

/** How many lessons the panel draws, newest first; the note says how many there are in all. */
const LESSON_ROWS = 15;
import { holdsCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   lessons: import("../../../lib/served.mjs").ServedTable,
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
  const st = servedRead(payloads, ctx, base.reads, "/api/memory");
  const all = asArray(st.body["lessons"]).filter((l) => field(asObject(l), "id") !== "").length;
  const malformed = typeof st.body["malformed"] === "number" ? st.body["malformed"] : 0;
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "retro", v: logged !== undefined && logged.isRead ? logged.size : "—", l: "The retro log", sub: "its size, as the door serves it" },
      { key: "concepts", v: holdsCount(base, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "cost", v: "—", l: "Recall cost", sub: "not served yet" },
    ],
    lessons: servedTable(projected(st, "lessons", (b) => (Array.isArray(b["lessons"]) ? b["lessons"].slice(-LESSON_ROWS).reverse() : undefined)), {
      panel: "Lessons",
      route: "/api/memory",
      columns: ["logged", "the lesson", "its prevention"],
      listKey: "lessons",
      empty: "The retro log holds no lesson row.",
      row: (l) => {
        const id = field(l, "id");
        return id === "" ? null : { key: id, cells: [`${field(l, "date")} · ${field(l, "project")}`, field(l, "pattern"), field(l, "prevention")] };
      },
      note: [
        st.isRead ? `the newest ${Math.min(LESSON_ROWS, all)} of ${all}` : "",
        malformed > 0 ? `${malformed} row${malformed === 1 ? "" : "s"} the adapter refused as malformed` : "",
        "no lane counts a lesson's repeats or marks one promoted yet, so each row is one retro-log entry",
      ].filter((n) => n !== "").join(" · "),
    }),
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
      "What one recall costs today, measured rather than estimated. The recall golden gate measures top-3 hits against a grep baseline, not cost, and no receipt records what a recall cost -- filed to the memory lane.",
    ),
  };
}
