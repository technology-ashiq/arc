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

/** What each ring is FOR, in the owner's terms rather than the architecture's. */
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
  return findRoom(rooms, "today") ?? rooms.find((r) => r.ring === "command" && !r.template) ?? rooms[0] ?? null;
}
