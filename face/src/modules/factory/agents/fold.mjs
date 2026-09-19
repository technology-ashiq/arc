// fold.mjs -- factory/agents: every decision the agents room makes, where node can import it with no install
// (face v2 Phase 03, company ring PR, ADR-1320, ADR-1324, ADR-1326, ADR-1327).
//
// v0.7's Agents: the roster. arc does not serve this room -- the owner's ruling left it an ADR-1327 exemption
// (ADR-1337) -- so the shell draws it from its exemption row. The roster is real all the same: every agent the served
// registry homes, and the room each works in, from the list the shell already read. What is not served: each agent's
// tier and whether it is switched on, which /api/roster will read from each agent's own frontmatter. A tier is law,
// not taste (ADR-0069): adding an agent, with its tier declared, is a verb of the work door.
import { notServed } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { heldAcrossRooms } from "../../../lib/lane-room.mjs";

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
 * @property {import("../../../lib/registry.mjs").NotServed} tiers
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
      { key: "tiers", v: "—", l: "High-judgment tier", sub: "not served yet · /api/roster" },
      { key: "on", v: "—", l: "Switched on", sub: "not served yet · /api/roster" },
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
    tiers: notServed(
      "Tiers and who is switched on",
      "/api/roster",
      "Each agent's tier -- cheap scan, balanced workhorse, high judgment, independent-family verifier -- and whether it is enabled. An agent's frontmatter carries its name, tools and model, but no tier and no enabled flag, and no importable parser reads it -- filed to the engine lane.",
    ),
    law: "An employee here is an agent spawned for a task, then gone. Tiers are law, not taste: a tier change is a production change, reviewed and cited, never a quiet edit (ADR-0069).",
    reads: [],
  };
}
