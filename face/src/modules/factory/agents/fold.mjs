// fold.mjs -- factory/agents: every decision the agents room makes, where node can import it with no install
// (face v2 Phase 03, company ring PR, ADR-1320, ADR-1324, ADR-1326, ADR-1327).
//
// v0.7's Agents: the roster. arc does not serve this room -- the owner's ruling left it an ADR-1327 exemption
// (ADR-1337) -- so the shell draws it from its exemption row. The roster is real all the same: every agent the served
// registry homes, and the room each works in, from the list the shell already read. What is not served: each agent's
// tier and whether it is switched on, which /api/roster will read from each agent's own frontmatter. A tier is law,
// not taste (ADR-0069): adding an agent, with its tier declared, is a verb of the work door.
import { fmtInt } from "../../../lib/inbox.mjs";
import { heldAcrossRooms } from "../../../lib/lane-room.mjs";
import { asArray, asObject, servedRead } from "../../../lib/served.mjs";
import { stateOfTable } from "../../../lib/availability.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {{ key: string, name: string, room: string, roomName: string, canOpen: boolean }[]} roster
 * @property {{ key: string, room: string, roomName: string, canOpen: boolean, names: string[] }[]} byRoom
 * @property {boolean} isRosterEmpty
 * @property {boolean} isRosterPartial
 * @property {string} partial
 * @property {string} rosterEmpty
 * @property {{ isReading: boolean, isRefused: boolean, refusal: { code: string, human: string }, rows: { key: string, name: string, model: string, tier: string, source: string, isHigh: boolean, isUnmapped: boolean, ink: string }[], note: string, availability: string }} tiers
 * @property {string} law
 * @property {Read[]} reads
 */

/**
 * @param {Record<string, Payload>} _payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(_payloads, ctx) {
  const held = heldAcrossRooms(ctx, "agents");
  /** @type {Read[]} */
  const reads = [];
  // Cycle 17 P03 (REQ-08, ADR-1367): the tier each agent's model implies, as the door served it -- never re-derived here.
  const st = servedRead(_payloads, ctx, reads, "/api/roster");
  const served = st.isRead && Array.isArray(st.body["agents"]) && st.body["agentsUnreadable"] !== true;
  const tierRows = served ? asArray(st.body["agents"]).map((a) => asObject(a)).filter((a) => typeof a["name"] === "string").map((a) => ({
    key: String(a["name"]), name: String(a["name"]), model: typeof a["model"] === "string" ? a["model"] : "", tier: typeof a["tier"] === "string" ? a["tier"] : "unmapped",
    source: typeof a["tier_source"] === "string" ? a["tier_source"] : "", isHigh: a["tier"] === "high-judgment", isUnmapped: a["tier"] !== "high-judgment" && a["tier"] !== "balanced-workhorse" && a["tier"] !== "cheap-scan" && a["tier"] !== "independent-family-verifier",
    on: a["enabled"] === true,
  })) : [];
  const unread = st.isReading ? "reading /api/roster" : st.isRefused ? st.refusal.code : "the roster served no agent list";
  const roster = held.rows.map((r) => ({ key: r.key, name: r.name, room: r.room, roomName: r.roomName, canOpen: r.canOpen }));
  // An agent the registry homes in two rooms is one agent (company ring attack).
  const agentsCount = new Set(roster.map((r) => r.name)).size;
  /** @type {Map<string, { key: string, room: string, roomName: string, canOpen: boolean, names: string[] }>} */
  const groups = new Map();
  for (const r of roster) {
    const g = groups.get(r.room) ?? { key: r.room, room: r.room, roomName: r.roomName, canOpen: r.canOpen, names: [] };
    g.names.push(r.name);
    groups.set(r.room, g);
  }
  const isUnread = held.unreadable.length > 0;
  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: "not in arc's registry · ADR-1327",
    kpis: [
      { key: "agents", v: isUnread ? "—" : fmtInt(agentsCount), l: "Agents on the roster", sub: "homed by the served registry" },
      { key: "rooms", v: isUnread ? "—" : fmtInt(groups.size), l: "Rooms they work in", sub: agentsCount < roster.length ? "an agent is homed in more than one" : "each agent in one" },
      { key: "tiers", v: served ? fmtInt(tierRows.filter((r) => r.isHigh).length) : "—", l: "High-judgment tier", sub: served ? `implied by model · ${fmtInt(tierRows.filter((r) => r.isUnmapped).length)} unmapped` : unread },
      { key: "on", v: served ? fmtInt(tierRows.filter((r) => r.on).length) : "—", l: "Switched on", sub: served ? "every agent file the harness loads" : unread },
    ],
    roster,
    byRoom: [...groups.values()],
    isRosterEmpty: roster.length === 0,
    // A roster with rooms the registry carried unreadably is PARTIAL, and says so beside the part it draws.
    isRosterPartial: isUnread && roster.length > 0,
    partial: isUnread ? `Partial: the served registry carried agents unreadably in ${held.unreadable.join(", ")}, so their agents are not drawn and none of the counts above is given.` : "",
    rosterEmpty: isUnread
      ? `The served registry carried agents unreadably in ${held.unreadable.join(", ")} -- none is drawn, and none is claimed absent.`
      : "The served registry homes no agent in any room.",
    tiers: {
      isReading: st.isReading,
      isRefused: st.isRefused,
      refusal: st.refusal,
      rows: tierRows.map(({ on: _on, ...r }) => ({ ...r, ink: r.isUnmapped ? "var(--amber)" : "var(--text-2)" })),
      availability: stateOfTable({ isReading: st.isReading, isRefused: st.isRefused, refusal: st.refusal, isDrawn: served, rows: tierRows }).availability,
      note: "Each tier is implied by the model the agent's frontmatter names, through engine/router.yaml's models map -- a model the map does not name reads unmapped, never a guessed tier (ADR-0069, ADR-1367).",
    },
    law: "An employee here is an agent spawned for a task, then gone. Tiers are law, not taste: a tier change is a production change, reviewed and cited, never a quiet edit (ADR-0069).",
    reads,
  };
}
