// fold.mjs -- kernel/model-policy: every decision the model-policy room makes, where node can import it
// with no install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's ModelPolicy onto the door. What is real: the model-policy lane's header, the router
// file's path and hash, and -- through /api/model-policy (Phase 04) -- the tier table and the process routes,
// parsed from that file by the engine lane's own reader. What is still NOT SERVED: the egress allowlist, which
// only the egress proxy parses, in Python, so no parser exists for the door to import. Proposing a tier is a
// verb of the work door (Phase 05); until then the room says so instead of drawing a button that writes nothing.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { asArray, asObject, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";
import { holdsCount, laneBadge, laneKpi, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   tiers: import("../../../lib/served.mjs").ServedTable,
 *   routesTable: import("../../../lib/served.mjs").ServedTable,
 *   propose: { isVerbPending: true, verb: string, sentence: string },
 *   egress: import("../../../lib/registry.mjs").NotServed,
 *   bench: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, {
    files: ["router"],
    trailEmpty: "The registry homes no receipt kind here. A tier change is a reviewed diff to the router file, and the merge that lands it is its record.",
  });
  const st = servedRead(payloads, ctx, base.reads, "/api/model-policy");
  const tierCount = st.isRead ? String(asArray(st.body["tiers"]).length) : "—";
  const routeCount = st.isRead ? String(asArray(st.body["classes"]).length) : "—";
  return {
    ...base,
    badge: laneBadge(base),
    kpis: [
      laneKpi(base),
      { key: "concepts", v: holdsCount(base, "concepts"), l: "Concepts", sub: "homed here by the registry" },
      { key: "tiers", v: tierCount, l: "Tiers", sub: st.isRead ? "in the router file's tier block" : "reading the router" },
      { key: "routes", v: routeCount, l: "Process routes", sub: st.isRead ? "task classes, and the default row" : "reading the router" },
    ],
    tiers: servedTable(st, {
      panel: "The tier table",
      route: "/api/model-policy",
      columns: ["tier", "implemented by"],
      listKey: "tiers",
      empty: "engine/router.yaml declares no tier.",
      row: (t) => {
        const tier = field(t, "tier");
        const models = asArray(t["models"]).map((m) => `${field(asObject(m), "driver")}: ${field(asObject(m), "model")}`);
        return tier === "" ? null : { key: tier, cells: [tier, models.length > 0 ? models.join(" · ") : "no model pinned -- a driver runs it unpinned and says so"] };
      },
      note: "each tier's job description is ADR-0069's prose; the router file names only the model that implements it today",
    }),
    routesTable: servedTable(st, {
      panel: "Process routes",
      route: "/api/model-policy",
      columns: ["process class", "tier", "driver, then fallback", "cap · judge · review by"],
      listKey: "classes",
      empty: "engine/router.yaml routes no process class.",
      row: (c) => {
        const name = field(c, "name");
        const chain = [field(c, "driver"), ...asArray(c["fallback"]).map(cell)].filter((d) => d !== "").join(" → ");
        const terms = field(c, "cap") === "" ? "—" : `${field(c, "cap")} · ${field(c, "judge")} · ${field(c, "review_by")}${c["expired"] === true ? " (past it)" : ""}`;
        return name === "" ? null : { key: name, cells: [name, field(c, "tier"), chain, terms] };
      },
    }),
    propose: verbPending(
      "Propose a tier change",
      "A tier change is a reviewed diff to the router file citing ADR-0069, raised to your inbox for a stamp; the route keeps its tier until you stamp. The face raises it once the work door exists.",
    ),
    egress: notServed(
      "Egress allowlist",
      "/api/model-policy",
      "The exact host and port each driver may reach. The router file carries no egress block; the allowlist is engine/egress-allowlist.txt, which only the egress proxy parses, in Python, so no parser exists for the door to import -- filed to the engine lane.",
    ),
    bench: roomLink(ctx, "bench"),
  };
}
