// fold.mjs -- kernel/absorb: every decision the absorb room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Absorb onto the door. What is real: the absorb lane's header and the decision
// receipts the registry homes here -- every decision.recorded, which the room says, because that kind is
// not intake's alone -- and, through /api/absorb (Phase 04), the technique registry and the adopted count per
// lane against the cap, judged by absorb's own registry lint, whose warnings the panel carries. Capturing,
// advancing, adopting and retiring are verbs of the work door (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, holdsCount, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   captureVerb: { isVerbPending: true, verb: string, sentence: string },
 *   registry: import("../../../lib/served.mjs").ServedTable,
 *   adopted: import("../../../lib/served.mjs").ServedTable,
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const st = servedRead(payloads, ctx, base.reads, "/api/absorb");
  // A body with no warnings LIST is the lint's verdict unread, never "no warning" (Phase 04 attack).
  const warningsRead = Array.isArray(st.body["warnings"]);
  const warnings = asArray(st.body["warnings"]).map(cell).filter((w) => w !== "");
  const cap = cell(st.body["cap"]);
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "decisions", v: kindCount(base, "decision.recorded"), l: "Decisions recorded", sub: countedOn(base, "every decision.recorded, not intake's alone") },
      { key: "commands", v: holdsCount(base, "commands"), l: "Commands", sub: "homed here by the registry" },
      { key: "lints", v: holdsCount(base, "lints"), l: "Lints", sub: "homed here by the registry" },
    ],
    captureVerb: verbPending(
      "Absorb something",
      "A candidate tool, skill, repo or dependency is captured, studied read-only, reported and vetted before anything installs. Capture arrives with the work door.",
    ),
    registry: servedTable(st, {
      panel: "The registry",
      route: "/api/absorb",
      columns: ["technique", "status · lane", "from", "the report behind it"],
      listKey: "techniques",
      empty: "The registry holds no technique yet.",
      row: (t) => {
        const id = field(t, "id");
        const decided = field(t, "adopt") || field(t, "retire");
        // A ULID is shortened to its tail; a decision named by a path is shown whole, never cut to `s/x.md`.
        const decidedBy = /^[0-9A-HJKMNP-TV-Z]{26}$/.test(decided) ? decided.slice(-6) : decided;
        const evidence = asArray(t["evidence"]).map(cell).filter((e) => e !== "").length;
        return id === "" ? null : { key: id, cells: [`${id} · ${field(t, "name")}`, `${field(t, "status")} · ${field(t, "lane")}`, field(t, "source") || "no source named", `${field(t, "classification") || "no report"} · ${evidence} evidence file${evidence === 1 ? "" : "s"}${decidedBy !== "" ? ` · decided ${decidedBy}` : ""}`] };
      },
      note: !warningsRead
        ? (st.isRead ? "the body carried no warnings list, so the registry lint's verdict is unread" : "")
        : warnings.length === 0
        ? "absorb's registry lint reports no warning on it"
        : `absorb's registry lint warns ${warnings.length} time${warnings.length === 1 ? "" : "s"}: ${warnings.join(" · ")}`,
    }),
    adopted: servedTable(st, {
      panel: "Adopted per lane",
      route: "/api/absorb",
      columns: ["lane", "adopted", "the cap"],
      listKey: "adoptedPerLane",
      empty: "No technique is adopted in any lane yet.",
      row: (a) => {
        const lane = field(a, "lane");
        return lane === "" ? null : { key: lane, cells: [lane, cell(a["adopted"]), cap] };
      },
      note: st.isRead ? `the cap is ${cap} adopted per lane; at it, a new adoption names what it displaces` : "",
    }),
  };
}
