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
import { payloadOf } from "../../../lib/registry.mjs";
import { fmtInt, readSpinePage } from "../../../lib/inbox.mjs";
import { catalogueOf, laneBadge, laneRoom, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/** The pins, read by their note: every other note.logged on the spine is skipped at the door (`note=`). */
const PIN_READ = Object.freeze({ route: "/api/spine", query: Object.freeze({ kind: "note.logged", note: "toolbelt.pin", limit: 500 }) });
/** A section's pin prefix, as the face-ops row spells a tool: `<singular>:<name>`. */
const SINGULAR = Object.freeze({ commands: "command", agents: "agent", hooks: "hook", rules: "rule", lints: "lint", processes: "process", gates: "gate", products: "product", capabilities: "capability" });

/**
 * The pinned tools, replayed in append order: a pin adds, an unpin removes, the last word on a tool wins. Pure.
 * @param {{ payload: Record<string, unknown> }[]} events
 * @returns {string[]} the pinned tool names, in the order they were pinned
 */
export function replayPins(events) {
  /** @type {Map<string, true>} */
  const pinned = new Map();
  for (const e of events) {
    const tool = typeof e.payload["tool"] === "string" ? e.payload["tool"] : "";
    if (tool === "") continue;
    if (e.payload["action"] === "pin") { pinned.delete(tool); pinned.set(tool, true); }
    else if (e.payload["action"] === "unpin") pinned.delete(tool);
  }
  return [...pinned.keys()];
}

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
 *   pins: { tool: string, name: string, roomName: string, room: string, canOpen: boolean, found: boolean }[],
 *   hasPins: boolean,
 *   pinsNote: string,
 *   hasPinsNote: boolean,
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
  const pinP = payloadOf(payloads, PIN_READ);
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  const find = typeof picks.find === "string" ? picks.find : "";
  const needle = find.trim().toLowerCase();
  // The catalogue is built ONCE per fold, in one pass over the rooms, and the find box filters what was
  // built -- never nine passes and a room search per row on every keystroke (money ring, the factory
  // ring's debt row).
  const built = catalogueOf(ctx, SECTIONS.map(([key]) => key));
  const all = SECTIONS.map(([key, label]) => {
    const read = built[key] ?? { rows: [], unreadable: [] };
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
  // A catalogue with a section read unreadably has no honest total: the rows that could be read are a floor, and
  // every figure built on them says so, instead of a short number beside a section that reads unread (money ring).
  const anyUnread = unreadable.length > 0;
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
      { key: "total", v: anyUnread ? "—" : fmtInt(total), l: "In the catalogue", sub: anyUnread ? "a section was not read in full" : needle === "" ? "every section" : `${fmtInt(matches)} match the find box` },
    ],
    find,
    sections,
    catalogueNote: unreadable.length === 0 ? "" : `${unreadable.join(", ")} carried a list here in a shape this shell could not read, so the counts above leave it out`,
    hasCatalogueNote: unreadable.length > 0,
    hasMatches: matches > 0,
    hasFindNote: needle !== "",
    findNote: needle === "" ? "" : matches === 0 ? `nothing in the catalogue matches ${JSON.stringify(find.trim())}${anyUnread ? " -- in the sections that could be read" : ""}` : `${fmtInt(matches)} of ${anyUnread ? "the readable" : fmtInt(total)} match ${JSON.stringify(find.trim())}`,
    ...pinsOf(pinP, all),
    ask: roomLink(ctx, "ask-arc"),
    reads: [...base.reads, PIN_READ],
  };
}

/**
 * The pinned panel: each pin matched to its catalogue row by `<section>:<name>`, or named as gone. A page that could
 * not be read says so -- an empty panel would read as "nothing pinned".
 * @param {Payload} pinP @param {{ key: string, rows: { name: string, room: string, roomName: string, canOpen: boolean }[] }[]} all
 */
function pinsOf(pinP, all) {
  if (pinP.state !== "ok") {
    const pinsNote = pinP.state === "refused" ? `the pins could not be read -- ${pinP.code}` : "reading the pins…";
    return { pins: [], hasPins: false, pinsNote, hasPinsNote: true };
  }
  const page = readSpinePage(pinP.data);
  const names = replayPins(page.events);
  const pins = names.map((tool) => {
    const [section, ...rest] = tool.split(":");
    const name = rest.join(":");
    const s = all.find((x) => SINGULAR[/** @type {keyof typeof SINGULAR} */ (x.key)] === section);
    const row = s ? s.rows.find((r) => r.name === name) : undefined;
    return row
      ? { tool, name, roomName: row.roomName, room: row.room, canOpen: row.canOpen, found: true }
      : { tool, name: name || tool, roomName: "no longer in the registry", room: "", canOpen: false, found: false };
  });
  const pinsNote = page.more ? "the newest pins past the first 500 are not replayed here -- unpin some to keep the list honest" : pins.length === 0 ? "nothing pinned yet -- pin a tool with the card below" : "";
  return { pins, hasPins: pins.length > 0, pinsNote, hasPinsNote: pinsNote !== "" };
}
