// fold.mjs -- factory/toolbelt: every decision the toolbelt makes, where node can import it with no
// install (face v2 Phase 03, ADR-1320, ADR-1324, ADR-1326).
//
// The port of v0.7's Toolbelt onto the door, and the one room whose subject is the registry itself: the
// catalogue is what EVERY served room holds, read from the registry the shell already fetched, with the
// room that holds each thing beside it. Nothing here is typed and nothing is fetched twice -- a command
// added to a room's holds appears in this room the day the registry carries it.
//
// The find box filters every section at once, from `picks.find`; v0.7's pin is a write and waits for the
// work door (Phase 05), and "explain" is a link to the ask room rather than a second asking surface.
import { verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { heldAcrossRooms, laneBadge, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * The catalogue's sections, in the order a person looks for them, each a key the registry homes.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const SECTIONS = Object.freeze([
  ["commands", "Commands"],
  ["agents", "Agents"],
  ["hooks", "Hooks"],
  ["rules", "Rules"],
  ["lints", "Lints"],
  ["processes", "Processes"],
  ["gates", "Gates"],
  ["products", "Products"],
  ["capabilities", "Capabilities"],
]);

/**
 * @typedef {{ key: string, name: string, room: string, roomName: string, canOpen: boolean }} ToolRow
 *
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   find: string,
 *   sections: { key: string, label: string, count: string, rows: ToolRow[], hasRows: boolean, empty: string }[],
 *   catalogueNote: string,
 *   hasCatalogueNote: boolean,
 *   hasMatches: boolean,
 *   findNote: string,
 *   hasFindNote: boolean,
 *   pinVerb: { isVerbPending: true, verb: string, sentence: string },
 *   ask: { canOpen: boolean, room: string },
 * }} Folded
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  const find = typeof picks.find === "string" ? picks.find : "";
  const needle = find.trim().toLowerCase();
  const all = SECTIONS.map(([key, label]) => {
    const read = heldAcrossRooms(ctx, key);
    return { key, label, rows: read.rows, unreadable: read.unreadable };
  });
  // A room that carried one of these lists in a shape this shell could not read is NAMED: a catalogue
  // that quietly shrank is the same lie as a count nobody served (Phase 03 attack).
  const unreadable = [...new Set(all.flatMap((s) => s.unreadable))];
  const sections = all.map((s) => {
    const rows = needle === "" ? s.rows : s.rows.filter((r) => r.name.toLowerCase().includes(needle) || r.roomName.toLowerCase().includes(needle));
    return {
      key: s.key,
      label: s.label,
      count: s.unreadable.length > 0 ? "—" : fmtInt(rows.length),
      rows,
      hasRows: rows.length > 0,
      // "nothing matched your find" and "the registry homes none of these" are different sentences,
      // and neither of them is "this list could not be read" (Phase 03 attack).
      empty: s.unreadable.length > 0
        ? `${s.unreadable.join(", ")} carried this list in a shape this shell could not read`
        : needle === "" ? "the served registry homes none of these" : "nothing here matches",
    };
  });
  const matches = sections.reduce((n, s) => n + s.rows.length, 0);
  const total = all.reduce((n, s) => n + s.rows.length, 0);
  /** @param {string} key */
  const figure = (key) => (all.some((s) => s.key === key && s.unreadable.length > 0) ? "—" : fmtInt((all.find((s) => s.key === key) ?? { rows: [] }).rows.length));

  return {
    ...base,
    badge: laneBadge(base, "the registry, read back"),
    kpis: [
      { key: "commands", v: figure("commands"), l: "Commands", sub: "across every served room" },
      { key: "agents", v: figure("agents"), l: "Agents", sub: "across every served room" },
      { key: "hooks", v: figure("hooks"), l: "Hooks", sub: "across every served room" },
      { key: "lints", v: figure("lints"), l: "Lints", sub: "across every served room" },
      { key: "rules", v: figure("rules"), l: "Rules", sub: "across every served room" },
      { key: "total", v: fmtInt(total), l: "In the catalogue", sub: needle === "" ? "every section" : `${fmtInt(matches)} match the find box` },
    ],
    find,
    sections,
    catalogueNote: unreadable.length === 0 ? "" : `${unreadable.join(", ")} carried a list here in a shape this shell could not read, so the counts above leave it out`,
    hasCatalogueNote: unreadable.length > 0,
    hasMatches: matches > 0,
    hasFindNote: needle !== "",
    findNote: needle === "" ? "" : matches === 0 ? `nothing in the catalogue matches ${JSON.stringify(find.trim())}` : `${fmtInt(matches)} of ${fmtInt(total)} match ${JSON.stringify(find.trim())}`,
    pinVerb: verbPending(
      "Pin a tool to the top of this room",
      "A pin is a receipt, so the room remembers what the owner reaches for most. It arrives with the work door.",
    ),
    ask: roomLink(ctx, "ask-arc"),
  };
}
