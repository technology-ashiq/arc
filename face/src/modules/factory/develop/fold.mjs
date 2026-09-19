// fold.mjs -- factory/develop: every decision the develop room makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Develop onto the door. What is real: the develop lane's header and its phase specs
// by number, the slice receipts the registry homes here, counted by kind and drawn as a trail, and -- through
// /api/slices (Phase 04) -- the slices of every LIVE lane's current phase, parsed from its task file by
// develop's own ledger parser, with the proven count that half of the Definition of Done is. The other half --
// tests green on CI per job, evidence bundled -- is checked by /arc-phase-done from the main clone, and the
// panel says so rather than claiming it. Opening a slice, recording a proof and closing a phase are work-door
// verbs (Phase 05).
import { verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, field, projected, servedRead, servedTable } from "../../../lib/served.mjs";
import { countedOn, kindCount, laneBadge, laneKpi, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   slices: import("../../../lib/served.mjs").ServedTable,
 *   dod: import("../../../lib/served.mjs").ServedTable,
 *   closeVerb: { isVerbPending: true, verb: string, sentence: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  const st = servedRead(payloads, ctx, base.reads, "/api/slices");
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "done", v: kindCount(base, "slice.done"), l: "Slices proven", sub: countedOn(base, "slice.done") },
      { key: "stuck", v: kindCount(base, "slice.stuck"), l: "Slices stuck", sub: countedOn(base, "slice.stuck") },
      { key: "started", v: kindCount(base, "develop.started"), l: "Harness starts", sub: countedOn(base, "develop.started") },
      { key: "handoff", v: kindCount(base, "handoff.ready"), l: "Handoffs ready", sub: countedOn(base, "handoff.ready") },
    ],
    // Every lane's slices in one table, each row named by its lane: a slice id repeats across lanes.
    slices: servedTable(projected(st, "rows", (b) => (Array.isArray(b["lanes"])
      ? b["lanes"].flatMap((l) => asArray(asObject(l)["slices"]).map((x) => ({ ...asObject(x), lane: asObject(l)["lane"], phase: asObject(l)["phase"] })))
      : undefined)), {
      panel: "Slices",
      route: "/api/slices",
      columns: ["lane · phase · slice", "what it proves", "tier", "proven"],
      listKey: "rows",
      empty: "No LIVE lane's current phase has a task file with a slice in it.",
      row: (x) => {
        const id = field(x, "id");
        const lane = field(x, "lane");
        return id === "" || lane === "" ? null : {
          key: `${lane}/${id}`,
          cells: [`${lane} · ${field(x, "phase")} · ${id}`, field(x, "title"), field(x, "tier") || "undeclared", x["proven"] === true ? `yes · ${field(x, "commit").slice(0, 12)}` : "not yet"],
        };
      },
    }),
    dod: servedTable(st, {
      panel: "The Definition of Done",
      route: "/api/slices",
      columns: ["lane · phase", "slices proven", "next unproven", "task file"],
      listKey: "lanes",
      empty: "No lane is LIVE, so no phase is being measured against its close.",
      row: (l) => {
        const lane = field(l, "lane");
        const total = typeof l["total"] === "number" ? l["total"] : 0;
        const proven = typeof l["proven"] === "number" ? l["proven"] : 0;
        // A heading the ledger parser REFUSED is a slice nobody can see: while there is one, the file does not prove
        // its close, and "every slice proven" would be a claim over the slices that parsed (Phase 04 attack).
        const errors = typeof l["errors"] === "number" ? l["errors"] : 0;
        const present = l["present"] === true;
        const next = !present ? "—"
          : errors > 0 ? `${errors} slice heading${errors === 1 ? "" : "s"} the parser refused -- the file does not prove its close`
            : field(l, "next") !== "" ? field(l, "next")
              : total > 0 ? "none -- every slice proven" : "no slice";
        return lane === "" ? null : {
          key: lane,
          cells: [`${lane} · ${field(l, "phase")}`, present ? `${proven} of ${total}${errors > 0 ? ` (+${errors} unread)` : ""}` : "—", next, present ? field(l, "file") : (field(l, "why") || "no task file")],
        };
      },
      note: "every slice proven is computed here; tests green on CI per job and the evidence bundle are checked by /arc-phase-done from the main clone, not by the door",
    }),
    closeVerb: verbPending(
      "Close a phase on evidence",
      "The close is refused unless the Definition of Done computes, and the refusal is itself a receipt that says what is missing. It arrives with the work door.",
    ),
  };
}
