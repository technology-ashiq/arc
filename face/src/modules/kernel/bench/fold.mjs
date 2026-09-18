// fold.mjs -- kernel/bench: every decision the bench room makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Bench onto the door. What is real: the bench lane's header, the run.completed
// receipts grouped by the driver that ran them, the promotion proposals counted, and -- through /api/bench
// (Phase 04) -- every scored bench run, class by class, with NO PROPOSAL drawn as the result it is. Which run
// was the champion is not recorded on any receipt, so the table never labels one. Adding a model, running a
// scorecard and proposing a promotion are verbs of the work door (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { countedOn, hasKind, kindCount, laneBadge, laneKpi, laneRoom, roomLink, runsBy } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   scorecards: import("../../../lib/served.mjs").ServedTable,
 *   drivers: import("../../../lib/lane-room.mjs").RunRow[],
 *   showDriversEmpty: boolean,
 *   addVerb: { isVerbPending: true, verb: string, sentence: string },
 *   policy: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const runsHomed = hasKind(base, "run.completed");
  const drivers = runsHomed ? runsBy(base.trail.events, "driver", ["process", "model", "duration_ms"], base.trail.isPartial) : [];
  const st = servedRead(payloads, ctx, base.reads, "/api/bench");
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "runs", v: kindCount(base, "run.completed"), l: "Runs completed", sub: countedOn(base, "run.completed") },
      { key: "drivers", v: runsHomed && base.trail.isDrawn ? `${fmtInt(drivers.length)}${base.trail.isPartial ? "+" : ""}` : "—", l: "Drivers seen", sub: runsHomed ? countedOn(base, "a driver named by a run receipt") : "the registry homes no run receipt here" },
      { key: "proposed", v: kindCount(base, "promotion.proposed"), l: "Promotions proposed", sub: countedOn(base, "promotion.proposed") },
    ],
    scorecards: servedTable(st, {
      panel: "The bench",
      route: "/api/bench",
      columns: ["run", "subject", "outcome", "per task class"],
      listKey: "runs",
      empty: "No bench run has been scored on this spine.",
      row: (r) => {
        const id = field(r, "id");
        const classes = asArray(r["classes"]).map((c) => {
          const k = asObject(c);
          // NO PROPOSAL is a result, drawn in the bench's own words -- never an empty cell.
          return `${field(k, "task_class")}: ${k["eligible"] === true ? (field(k, "proposal") !== "" ? "proposes" : "eligible") : field(k, "reason") || "not eligible"}`;
        });
        return id === "" ? null : { key: id, cells: [`${field(r, "ts").slice(0, 16)} · ${id.slice(-6)}`, `${field(r, "subject")}${field(r, "model") !== "" ? ` (${field(r, "model")})` : ""}`, field(r, "outcome"), classes.join(" · ") || "no class scored"] };
      },
      note: "each row is one scored run, from its run.completed receipt; which run is the champion is not written to any receipt, so no row is labelled one",
    }),
    drivers,
    showDriversEmpty: runsHomed && base.trail.isDrawn && drivers.length === 0,
    addVerb: verbPending(
      "Add a model to the bench",
      "A model joins as a challenger, runs its scorecard, and a win becomes a promotion proposal in your inbox. Every step arrives with the work door.",
    ),
    policy: roomLink(ctx, "model-policy"),
  };
}
