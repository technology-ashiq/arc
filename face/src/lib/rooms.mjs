// rooms.mjs -- how the 33 rooms are grouped, chosen and described.
//
// Every decision on this page is here rather than in a component, for the reason README.md
// gives: CI cannot exercise anything that needs node_modules, so a branch inside a .tsx is
// a branch nobody tests. If a view grows an `if` worth asserting, it belongs in this file.

/**
 * @typedef {object} RoomLive
 * @property {number} kindsHomed
 * @property {number} kindsFired
 * @property {number} receipts
 * @property {"live"|"unexercised"|"file-borne"|"index"} state
 *
 * @typedef {object} Room
 * @property {string} id
 * @property {string} name
 * @property {string} ring
 * @property {string} status
 * @property {string} sentence
 * @property {string} lede
 * @property {"bespoke"|"generic"|"index"} render
 * @property {string} [indexes]
 * @property {boolean} [planned]
 * @property {boolean} [template]
 * @property {string[]} stations
 * @property {Record<string, string[]>} holds
 * @property {number} itemCount
 * @property {RoomLive} live
 */

/**
 * The five rings, in the order they are read. `command` first is not alphabetical and not a
 * taste call: it is the daily surface, and the whole product is built around thirty to sixty
 * minutes a day. Everything else is one level in.
 */
export const RING_ORDER = ["command", "kernel", "factory", "money", "company"];

/**
 * What each ring is FOR, in the owner's terms rather than the architecture's.
 *
 * Typed as an open record on purpose: `byRing` looks a ring up by a string that came off
 * the wire, and so does the Map. Without the annotation TS infers the five literal keys and
 * refuses every lookup that is not proven to be one of them — which is the wrong shape for
 * a table whose whole job is to answer "and what if the contract grew a sixth ring?" with
 * `?? ""` rather than with a compile error.
 * @type {Record<string, string>}
 */
export const RING_LEDE = {
  command: "what needs you today",
  kernel: "the machinery that runs the machines",
  factory: "how work gets made and judged",
  money: "where the money is, and is not",
  company: "what the company is, in writing",
};

/**
 * Group rooms into rings, in RING_ORDER, dropping the lane TEMPLATE (it is a shape every
 * lane instantiates, not a room you can open) and putting planned rooms last inside their
 * ring so a dotted room never sits above a live one.
 *
 * A ring the registry does not use is omitted rather than rendered empty -- an empty ring
 * heading is the nav-shaped version of the empty-room lie.
 * @param {Room[]} rooms
 * @returns {{ ring: string, lede: string, rooms: Room[] }[]}
 */
export function byRing(rooms) {
  const out = [];
  for (const ring of RING_ORDER) {
    const inRing = rooms.filter((r) => r.ring === ring && !r.template);
    if (!inRing.length) continue;
    inRing.sort((a, b) => {
      if (Boolean(a.planned) !== Boolean(b.planned)) return a.planned ? 1 : -1;
      return 0; // otherwise the contract's own order, which is the owner's priority
    });
    out.push({ ring, lede: RING_LEDE[ring] ?? "", rooms: inRing });
  }
  // A room whose ring is not one of the five would vanish silently. Surface it instead:
  // the registry is generated, so this can only mean the contract grew a ring nobody taught
  // the shell about, and a missing room is exactly what this product exists not to have.
  const known = new Set(RING_ORDER);
  const orphans = rooms.filter((r) => !r.template && !known.has(r.ring));
  if (orphans.length) out.push({ ring: "unplaced", lede: "rooms in a ring this shell does not know", rooms: orphans });
  return out;
}

/**
 * The badge a room shows before it draws anything. Four states, four sentences, and none of
 * them is a bare zero -- "0" cannot distinguish "measured, and it is zero" from "this has
 * never run", and the whole Truth Law turns on that difference.
 * @param {Room} room
 * @returns {{ label: string, tone: "live"|"sim"|"file"|"index", title: string }}
 */
export function stateBadge(room) {
  switch (room.live.state) {
    case "live":
      return {
        label: "live",
        tone: "live",
        title: `${room.live.receipts} receipt${room.live.receipts === 1 ? "" : "s"} across ${room.live.kindsFired} of ${room.live.kindsHomed} kinds`,
      };
    case "unexercised":
      return {
        label: "unexercised",
        tone: "sim",
        title: `built and tested; not one of its ${room.live.kindsHomed} kinds has ever fired. Not a zero -- a kind that has not run has no count at all.`,
      };
    case "file-borne":
      return {
        label: "file, not log",
        tone: "file",
        title: "this room reads the tree and the contract; the spine has nothing to say about it, so as-of does not apply here",
      };
    case "index":
      return {
        label: "index",
        tone: "index",
        title: `renders every ${room.indexes ?? "entry"} in the company, not a slice of them`,
      };
    default:
      // Unreachable through the door, which validates the set. If it is ever reached, say so
      // rather than rendering a blank chip -- an unknown state shown as nothing is the lie.
      return { label: String(room.live.state), tone: "file", title: "a state this shell does not recognise" };
  }
}

/**
 * Whether `as-of` scrubbing is meaningful for a room. File-borne and index rooms have no
 * day-granular history, and offering a scrubber that silently does nothing is worse than
 * not offering one (REQ-05: the door refuses such an asof by name rather than inventing).
 * @param {Room} room
 */
export function supportsAsOf(room) {
  return room.live.state === "live" || room.live.state === "unexercised";
}

/**
 * The zones a generic room draws, in order, skipping the ones it has nothing for. This is
 * the 6-zone lane template of ADR-1306 generalised to every room: the room's own inventory
 * decides which zones exist, so a room with no commands never draws an empty Commands slab.
 * @param {Room} room
 * @returns {{ key: string, title: string, items: string[] }[]}
 */
export function zonesFor(room) {
  /** @type {[string, string][]} */
  const ORDER = [
    ["kinds", "What it records"],
    ["lanes", "Lanes"],
    ["products", "Products"],
    ["commands", "Commands"],
    ["agents", "Agents"],
    ["processes", "Processes"],
    ["gates", "Gates"],
    ["hooks", "Hooks"],
    ["rules", "Rules"],
    ["lints", "Lints"],
    ["concepts", "Vocabulary"],
  ];
  const zones = [];
  for (const [key, title] of ORDER) {
    const items = room.holds?.[key];
    if (Array.isArray(items) && items.length) zones.push({ key, title, items });
  }
  return zones;
}

/**
 * Find a room by id, or return null. Deliberately not throwing: an unknown room in a URL is
 * a thing a person can type, and the shell answers it with a named "no such room" rather
 * than a blank screen or a crash.
 * @param {Room[]} rooms @param {string} id
 */
export function findRoom(rooms, id) {
  return rooms.find((r) => r.id === id) ?? null;
}

/**
 * The room the shell opens on. `today` by law -- it is the front page the whole 30-60 minute
 * budget is built around -- but never a hard-coded string that could point at nothing: if
 * the registry ever stops carrying it, fall back to the first room of the command ring
 * rather than rendering emptiness.
 * @param {Room[]} rooms
 */
export function defaultRoom(rooms) {
  // `!r.template` on the middle arm and NOT on the last one: a twin-fix miss inside a single
  // expression. `defaultRoom` over a registry of templates alone returned the lane template --
  // the one room this module asserts elsewhere is "not offered as a room you can open".
  return findRoom(rooms, "today")
    ?? rooms.find((r) => r.ring === "command" && !r.template)
    ?? rooms.find((r) => !r.template)
    ?? null;
}

/* ═════════════════════════════════════════════════════════════════════════════
   Below this line: the decisions the two GENERIC renderers need — GenericRoom
   (every `render: "generic"` room) and IndexRoom (`render: "index"`: org,
   concepts). They live here for the reason the header gives, and the reason is
   not style: `node` can import this file with no install and no build, and it
   cannot import a .tsx at all. A branch that decides what a room SAYS about
   itself is exactly the branch that must not live where nothing can run it.
   ═════════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {{ code: string, human: string }} Refused
 *
 * @typedef {object} LaneRow
 * @property {string} lane
 * @property {string|null} status
 * @property {string|null} phase
 * @property {string|null} appetite
 * @property {string|null} burn
 * @property {string|null} blockedOn
 * @property {{ id: string, name: string }|null} room
 *
 * @typedef {{ ok: true, updated: string|null, rows: LaneRow[], counted: number,
 *             expected: number, shortfall: number }
 *          | { ok: false, code: string, human: string }} LaneRoster
 *
 * @typedef {{ term: string, station: string|null }} ConceptRow
 * @typedef {{ roomId: string, roomName: string|null, template: boolean, terms: ConceptRow[] }} ConceptGroup
 * @typedef {{ ok: true, path: string|null, sha256: string|null, total: number, expected: number,
 *             shortfall: number, orphans: number, groups: ConceptGroup[] }
 *          | { ok: false, code: string, human: string }} ConceptIndex
 */

/**
 * Reverse the door's display-safe escaping.
 *
 * `arc-dash` runs `escapeDeep` over EVERY response body, so every string L3 receives is
 * HTML-escaped: the product's own opening sentence arrives as
 * `If it isn&#39;t an event, it didn&#39;t happen.` and the Review &amp; Ship room arrives
 * with an `&amp;` in its name. React escapes again at render time, so without this the
 * entities are what the owner reads — the flagship line of the product, spelled wrong.
 *
 * This is the exact inverse of the door's `escapeHtml`, and the ORDER is the reason it is
 * exact: the door escapes `&` first, so the client must unescape `&amp;` LAST. Undoing it
 * in the other order turns `&amp;lt;` (a literal `&lt;` an author typed) into `<`, which
 * is the bug this comment exists to stop someone reintroducing.
 *
 * Safe by construction: the output is handed to React as TEXT, never as HTML, and React
 * escapes it on the way to the DOM. Nothing here re-opens the hole the door closed.
 * @param {unknown} value
 * @returns {string}
 */
export { unescapeDoorText } from "./door.mjs";
import { unescapeDoorText } from "./door.mjs";

/**
 * One value, rendered honestly. This is MISSING ≠ 0 as a function.
 *
 * A measured zero prints `0`, because it was measured. An absent value prints `MISSING`
 * and says so, because a blank cell and a zero are the two ways a surface lies about not
 * knowing something. Numbers are grouped by hand rather than by `toLocaleString`, which
 * would make the digits depend on the CI leg's ICU data.
 * @param {unknown} value
 * @returns {{ text: string, missing: boolean }}
 */
export function displayValue(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return { text: String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ","), missing: false };
  if (typeof value === "string" && value.trim().length)
    return { text: unescapeDoorText(value.trim()), missing: false };
  return { text: "MISSING", missing: true };
}

/**
 * The sentence and the code to show when a read fails.
 *
 * Duck-typed rather than `instanceof DoorError` on purpose: this module stays
 * dependency-free of the door (they are peers, not a stack), and a refusal this shell
 * raises itself — an inventory it has no sanctioned route for — must surface through the
 * same path as one the door raised. Never "something went wrong": the door refuses BY
 * NAME, and a client that swallows the name throws away the only part the owner can act on.
 * @param {unknown} err
 * @returns {Refused}
 */
export function errorSentence(err) {
  const e = err && typeof err === "object"
    ? /** @type {Record<string, unknown>} */ (err)
    : /** @type {Record<string, unknown>} */ ({});
  const code = typeof e.code === "string" && e.code.length ? e.code : "UNCAUGHT";
  const human = typeof e.human === "string" && e.human.length ? e.human
    : typeof e.message === "string" && e.message.length ? e.message
      : "the read failed and said nothing about why, which is itself the defect";
  return { code, human: unescapeDoorText(human) };
}

/**
 * The short mono notes a room head carries beside its badge.
 *
 * Two of the three are absences, and an absence stated is the whole point of D7: a planned
 * room says it is not built, the lane TEMPLATE says it is a shape rather than a door, and
 * every room says whether the as-of scrubber means anything here — because a scrubber that
 * silently does nothing is worse than no scrubber (REQ-05).
 * @param {Room} room
 * @returns {string[]}
 */
export function headNotes(room) {
  /** @type {string[]} */
  const notes = [];
  if (room.planned) notes.push("planned — declared in the contract, not built");
  if (room.template) notes.push("template — a shape every lane instantiates, not a room you can open");
  notes.push(supportsAsOf(room)
    ? "as-of — this room scrubs with the spine"
    : "as-of — not applicable here; nothing on this page has day-granular history");
  return notes;
}

/**
 * WHICH KIND OF NOTHING a generic room is showing, or null when it has zones to draw.
 *
 * Returning null is the common case and the important one: this never fires for a room
 * with content, so it cannot dilute a real room. When it does fire, the room says what the
 * emptiness IS. room-map.md D7 in one function: fourteen convincing empty rooms would be
 * worse than fourteen missing ones, because a missing room is honest.
 * @param {Room} room
 * @returns {{ label: string, detail: string }|null}
 */
export function absence(room) {
  if (zonesFor(room).length) return null;
  // An index room draws a whole inventory through the door; zones were never its shape.
  if (room.live.state === "index") return null;
  if (room.planned)
    return {
      label: "PLANNED — NOT BUILT",
      detail: "This room is in the frozen contract and nothing implements it yet. There is no data to draw and none is being invented: an empty panel here would be a room that looks finished.",
    };
  return {
    label: "NOT INSTRUMENTED",
    detail: "The contract homes no kinds, lanes, commands, agents, processes, gates, hooks, rules, lints or concepts in this room, so the template has nothing to draw. That is a gap in the contract, not an empty screen — and `face-coverage` is where it gets closed.",
  };
}

/**
 * Which SANCTIONED door route an index room reads, and the refusal when there is none.
 *
 * The endpoint set is closed (phase-06 spec: "any new L2 endpoint" is out of scope), so an
 * index room is served from what already exists: `lanes` from the board, `concepts` from
 * the allow-listed contract file. A third `indexes` value is a contract that grew past
 * this shell — it refuses by name rather than rendering a plausible blank list, which is
 * the same rule `byRing` applies to an unknown ring.
 * @param {Room} room
 * @returns {{ inventory: "lanes"|"concepts"|"unknown", route: string|null, refusal: Refused|null }}
 */
export function indexSource(room) {
  const what = typeof room.indexes === "string" ? room.indexes : "";
  if (what === "lanes") return { inventory: "lanes", route: "/api/board", refusal: null };
  if (what === "concepts") return { inventory: "concepts", route: "/api/file/expected-set", refusal: null };
  return {
    inventory: "unknown",
    route: null,
    refusal: {
      code: "UNKNOWN_INVENTORY",
      human: `This room says it indexes "${what || "nothing"}", and the door has no sanctioned route for that inventory. Nothing is drawn rather than a list that looks complete and is not.`,
    },
  };
}

/** @param {unknown} header @param {string} key @returns {string|null} */
function headerField(header, key) {
  if (!header || typeof header !== "object") return null;
  const v = /** @type {Record<string, unknown>} */ (header)[key];
  return typeof v === "string" && v.trim().length ? unescapeDoorText(v.trim()) : null;
}

/**
 * The whole company as a roster: every lane the board serves, in the order the owner reads
 * them, each carrying the room it opens into.
 *
 * Takes the RAW `/api/board` body rather than a pre-dug field, so the narrowing of an
 * untrusted response is asserted here instead of inside a component nothing can run.
 *
 * `expected` is the contract's own count (`room.itemCount` = 16). The board only serves a
 * lane that has both a `PORTFOLIO.md` row and an `initiatives/<lane>/PROGRESS.md`, so a
 * roster can come back SHORT — and a short roster that renders as a full one is precisely
 * the "nothing is missing" claim this product cannot afford to get wrong. The shortfall is
 * returned as a number so the room can say it out loud.
 *
 * Ordering: LIVE, then BLOCKED, then anything else, then lanes whose header could not be
 * read at all — ties keep the board's own order, which is the owner's priority (ADR-0051).
 * @param {unknown} payload  the raw GET /api/board body
 * @param {Room[]} rooms
 * @param {number} expected
 * @returns {LaneRoster}
 */
export function laneRoster(payload, rooms, expected) {
  const body = payload && typeof payload === "object" ? /** @type {Record<string, unknown>} */ (payload) : null;
  const raw = body && Array.isArray(body.lanes) ? body.lanes : null;
  if (!raw)
    return {
      ok: false,
      code: "BAD_BODY",
      human: "The board answered without a lane list. An empty roster is not drawn from that, because a company with no lanes is not what happened here — a read did.",
    };

  /** @type {Map<string, { id: string, name: string }>} */
  const home = new Map();
  for (const r of rooms) {
    if (r.template) continue;
    for (const lane of (r.holds && r.holds.lanes) || [])
      if (!home.has(lane)) home.set(lane, { id: r.id, name: unescapeDoorText(r.name) });
  }

  /** @type {Record<string, number>} */
  const RANK = { LIVE: 0, BLOCKED: 1 };
  const rows = raw.map((entry, i) => {
    const e = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
    const lane = typeof e.lane === "string" ? e.lane : "";
    const status = headerField(e.header, "status");
    return {
      i,
      // A lane whose header carries no status at all sorts LAST and renders MISSING —
      // never quietly as "the rest", which would read as a deliberate idle.
      rank: status === null ? 3 : RANK[status] ?? 2,
      row: /** @type {LaneRow} */ ({
        lane,
        status,
        phase: headerField(e.header, "phase"),
        appetite: headerField(e.header, "appetite"),
        burn: headerField(e.header, "burn"),
        blockedOn: headerField(e.header, "blocked-on"),
        room: home.get(lane) ?? null,
      }),
    };
  });
  rows.sort((a, b) => (a.rank === b.rank ? a.i - b.i : a.rank - b.rank));

  return {
    ok: true,
    updated: headerField(body, "updated"),
    rows: rows.map((r) => r.row),
    counted: rows.length,
    expected,
    shortfall: Math.max(0, expected - rows.length),
  };
}

/** @param {ConceptRow} a @param {ConceptRow} b */
function byTerm(a, b) {
  // Deterministic on every CI leg: localeCompare's ordering depends on the runtime's ICU
  // data, and a table that reorders itself between Windows and Linux is a diff nobody can
  // read. Case-insensitive first so `ULID` files beside `unlock ladder`, raw as the tiebreak.
  const la = a.term.toLowerCase(), lb = b.term.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
}

/**
 * The company's whole vocabulary, grouped by the room each term lives in.
 *
 * Fed the RAW `/api/file/expected-set` body: `{ text, sha256, path, badge }`. The text is
 * the frozen contract itself, so the room is reading the same file `face-coverage` checks
 * — not a second spelling of it.
 *
 * `orphans` is the finding room-map.md calls out by name: a concept homed in a room that
 * does not exist is a ⌘K result that opens nothing. It is counted rather than filtered
 * away, because a term silently dropped from this page is the gap the page exists to show.
 * @param {unknown} payload  the raw GET /api/file/expected-set body
 * @param {Room[]} rooms
 * @param {number} expected
 * @returns {ConceptIndex}
 */
export function conceptGroups(payload, rooms, expected) {
  const body = payload && typeof payload === "object" ? /** @type {Record<string, unknown>} */ (payload) : null;
  const text = body && typeof body.text === "string" ? unescapeDoorText(body.text) : null;
  if (text === null)
    return { ok: false, code: "BAD_BODY", human: "The door answered without the file's text, so there is no vocabulary to read and none is being guessed at." };

  /** @type {unknown} */
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {
    return { ok: false, code: "BAD_JSON", human: "The allow-listed contract file came back as text this shell could not parse as JSON. The vocabulary is not drawn from a partial read." };
  }
  const root = parsed && typeof parsed === "object" ? /** @type {Record<string, unknown>} */ (parsed) : null;
  const node = root && root.concepts && typeof root.concepts === "object" ? /** @type {Record<string, unknown>} */ (root.concepts) : null;
  const map = node && node.map && typeof node.map === "object" ? /** @type {Record<string, unknown>} */ (node.map) : null;
  if (!map)
    return { ok: false, code: "CONTRACT_SHAPE", human: "The contract file parsed, but carries no concepts.map — the inventory this room renders is not where it used to be, and a room that renders nothing is the honest answer to that." };

  /** @type {Map<string, { name: string, template: boolean }>} */
  const meta = new Map(rooms.map((r) => [r.id, { name: unescapeDoorText(r.name), template: Boolean(r.template) }]));
  /** @type {Map<string, ConceptRow[]>} */
  const buckets = new Map();
  let total = 0, orphans = 0;

  for (const term of Object.keys(map)) {
    const v = map[term];
    const row = v && typeof v === "object" ? /** @type {Record<string, unknown>} */ (v) : {};
    const roomId = typeof row.room === "string" ? row.room : "";
    total++;
    if (!meta.has(roomId)) orphans++;
    let bucket = buckets.get(roomId);
    if (!bucket) { bucket = []; buckets.set(roomId, bucket); }
    bucket.push({
      term: unescapeDoorText(term),
      station: typeof row.station === "string" && row.station.length ? unescapeDoorText(row.station) : null,
    });
  }

  /** @type {ConceptGroup[]} */
  const groups = [];
  const drawn = new Set();
  // Registry order first — which is ring order, which is the order the owner reads rooms in.
  for (const r of rooms) {
    const terms = buckets.get(r.id);
    if (!terms || !terms.length) continue;
    terms.sort(byTerm);
    groups.push({ roomId: r.id, roomName: unescapeDoorText(r.name), template: Boolean(r.template), terms });
    drawn.add(r.id);
  }
  // Then the homeless ones, last and unmistakable, rather than not at all.
  for (const [roomId, terms] of buckets) {
    if (drawn.has(roomId)) continue;
    terms.sort(byTerm);
    groups.push({ roomId, roomName: null, template: false, terms });
  }

  return {
    ok: true,
    path: body && typeof body.path === "string" ? unescapeDoorText(body.path) : null,
    sha256: body && typeof body.sha256 === "string" ? unescapeDoorText(body.sha256) : null,
    total,
    expected,
    shortfall: Math.max(0, expected - total),
    orphans,
    groups,
  };
}
