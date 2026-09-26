// fold.mjs -- company/concepts: every decision the concepts room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1326).
//
// The port of v0.7's Concepts onto the door. v0.7 read a glossary bundled at build time; here the glossary is the
// contract itself, expected-set.json, through the door's allow-listed file route -- the same file face-coverage
// validates and the palette searches, so this room cannot know a different set of words than arc does. Every term is
// grouped under the served room that homes it, with its station on that room's line; a term whose room is not served
// is counted out loud as unhomed. The search is the palette's fold: substring, first eight. Defining a term is a verb
// of the work door (concepts.define-term, ADR-1343).
import { fmtInt } from "../../../lib/inbox.mjs";
import { fileText, glossaryOf } from "../../../lib/company-room.mjs";
import { roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/** The palette's own window: the first eight hits. */
const HITS = 8;

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {import("../../../lib/lane-room.mjs").SourceFile} contract
 * @property {import("../../../lib/company-room.mjs").Glossary} glossary
 * @property {{ key: string, room: string, name: string, terms: import("../../../ui/company").TermView[], canOpen: boolean }[]} groups
 * @property {{ q: string, hits: import("../../../ui/company").HitView[], isEmpty: boolean, empty: string }} search
 * @property {{ key: string, term: string, room: string }[]} unhomed
 * @property {boolean} isUnhomedEmpty
 * @property {string} unhomedEmpty
 * @property {string} coverage
 * @property {Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Read[]} */
  const reads = [];
  const file = fileText(payloads, ctx, "expected-set", reads);
  const rooms = Array.isArray(ctx.rooms) ? ctx.rooms : [];
  const glossary = glossaryOf(file.text, rooms);
  const isRead = file.source.isRead && glossary.isRead;
  const nameOf = new Map(rooms.map((r) => [r.id, typeof r.name === "string" && r.name !== "" ? r.name : r.id]));
  const groups = glossary.byRoom.map((g) => ({
    key: g.room,
    room: g.room,
    name: g.name,
    terms: g.terms.map((t) => ({ key: t.term, term: t.term, station: t.station })),
    canOpen: roomLink(ctx, g.room).canOpen,
  }));
  const q = String((ctx.picks ?? {}).q ?? "").trim();
  const needle = q.toLowerCase();
  const hits = needle === "" ? [] : glossary.terms
    .filter((t) => t.term.toLowerCase().includes(needle) || t.room.includes(needle))
    .slice(0, HITS)
    .map((t) => ({ key: t.term, term: t.term, room: t.room, roomName: nameOf.get(t.room) ?? t.room, station: t.station, canOpen: roomLink(ctx, t.room).canOpen }));
  const stations = new Set(glossary.terms.filter((t) => t.station !== "").map((t) => `${t.room}/${t.station}`)).size;
  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: isRead ? "the glossary · the contract, through the door" : "the glossary · not read",
    kpis: [
      { key: "terms", v: isRead ? fmtInt(glossary.count) : "—", l: "Terms", sub: "expected-set.json, the palette's store" },
      { key: "rooms", v: isRead ? fmtInt(groups.length) : "—", l: "Rooms that hold them", sub: "each term anchored to one" },
      { key: "stations", v: isRead ? fmtInt(stations) : "—", l: "Stations", sub: "where on a room's line a term sits" },
      { key: "unhomed", v: isRead ? fmtInt(glossary.unhomed.length) : "—", l: "Unhomed", sub: glossary.unreadable > 0 ? `${fmtInt(glossary.unreadable)} entr${glossary.unreadable === 1 ? "y" : "ies"} this reader could not read` : "a term whose room this face does not draw" },
    ],
    contract: file.source,
    glossary,
    groups,
    search: {
      q,
      hits,
      isEmpty: hits.length === 0,
      empty: !isRead ? "" : q === "" ? "Type a word: the same substring fold the ⌘K palette runs, first eight hits." : `No term contains “${q}”.`,
    },
    unhomed: glossary.unhomed.map((t) => ({ key: t.term, term: t.term, room: t.room })),
    isUnhomedEmpty: glossary.unhomed.length === 0,
    unhomedEmpty: isRead ? "Every term is homed in a served room -- the rule face-coverage holds on the tree." : "",
    coverage: isRead
      ? `${fmtInt(glossary.count)} terms across ${fmtInt(groups.length)} rooms${glossary.unhomed.length ? ` · ${fmtInt(glossary.unhomed.length)} unhomed` : " · none unhomed"}. The contract is frozen: a new word lands by a reviewed diff to it -- Define a term opens one as a proposal branch you merge.`
      : "",
    // "Define a term" is LIVE since face v2 Phase 05 (ADR-1343): the work door's concepts.define-term op, drawn under
    // this room by the host. Its card is retired.
    reads,
  };
}
