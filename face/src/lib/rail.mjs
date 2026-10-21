// rail.mjs -- which of the rail's rings are open (face v3 P04, FV3-G "the shell gets out of the way").
//
// The rail lists every ring of the served registry; at 768 px tall it no longer fits, so a ring header folds its
// rooms away. Every decision is here, in plain ESM with no dependency, so node can hold it: which rings are open for a
// given current room and a viewer's saved choices, what a click on a header changes, and how the saved choices are
// read from and written to storage. Rail.tsx only renders and runs the storage effect (in try/catch: a viewer
// without storage gets the defaults, every time).
//
// The rules:
//   - the ring holding the room open now is always open (you never lose the row you are on);
//   - a ring the viewer folded or opened stays as they left it;
//   - a ring the viewer never touched is open only when it is the first ring of the served order (Command).

/** The localStorage key the viewer's choices live under. */
export const RAIL_STORAGE_KEY = "arc.face.rail.rings";

// A ring name is a key on plain objects here; one spelled like a prototype slot would write the prototype instead of
// a field (attack 0991e16 B2). Such a name is never a ring: it is dropped on read and never stored.
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
/** @param {unknown} k @returns {boolean} */
function usableKey(k) {
  return typeof k === "string" && k.length > 0 && k.length <= 64 && !RESERVED.has(k);
}

/** @typedef {{ ring: string, rooms: { id: string }[] }} RailGroup */
/** @typedef {Record<string, boolean>} RailSaved  ring name -> true (open) | false (folded), only rings the viewer touched */

/**
 * The ring holding a room, or null when no ring does (no room open, Settings, an unknown id).
 * @param {RailGroup[]} groups
 * @param {string | null | undefined} roomId
 * @returns {string | null}
 */
export function ringOf(groups, roomId) {
  if (!roomId || !Array.isArray(groups)) return null;
  for (const g of groups) {
    if (g && Array.isArray(g.rooms) && g.rooms.some((r) => r && r.id === roomId)) return g.ring;
  }
  return null;
}

/**
 * Which rings are open, by name.
 * @param {RailGroup[]} groups  the served rings, in order
 * @param {string | null | undefined} roomId  the room open now
 * @param {RailSaved} saved  the viewer's choices (parseSaved's result)
 * @returns {Record<string, boolean>}
 */
export function expandedRings(groups, roomId, saved) {
  /** @type {Record<string, boolean>} */
  const out = Object.create(null);
  if (!Array.isArray(groups)) return out;
  const here = ringOf(groups, roomId);
  const first = groups.length > 0 && groups[0] ? groups[0].ring : null;
  const s = saved && typeof saved === "object" ? saved : {};
  for (const g of groups) {
    if (!g || !usableKey(g.ring)) continue;
    if (g.ring === here) out[g.ring] = true;
    else if (Object.prototype.hasOwnProperty.call(s, g.ring)) out[g.ring] = s[g.ring] === true;
    else out[g.ring] = g.ring === first;
  }
  return out;
}

/**
 * Whether a ring's header can fold it: not when it holds the room open now.
 * @param {RailGroup[]} groups
 * @param {string | null | undefined} roomId
 * @param {string} ring
 * @returns {boolean}
 */
export function canFold(groups, roomId, ring) {
  return ringOf(groups, roomId) !== ring;
}

/**
 * The viewer's choices after a click on a ring's header. A click on the current room's ring changes nothing.
 * @param {RailGroup[]} groups
 * @param {string | null | undefined} roomId
 * @param {RailSaved} saved
 * @param {string} ring
 * @returns {RailSaved}
 */
export function toggleRing(groups, roomId, saved, ring) {
  const s = saved && typeof saved === "object" ? saved : {};
  if (!usableKey(ring) || !canFold(groups, roomId, ring)) return s;
  const open = expandedRings(groups, roomId, s)[ring] === true;
  /** @type {RailSaved} */
  const next = Object.create(null);
  for (const [k, b] of Object.entries(s)) if (usableKey(k) && typeof b === "boolean") next[k] = b;
  next[ring] = !open;
  return next;
}

/** The most ring choices a saved entry is read for: far above the rings a face has. */
export const SAVED_MAX = 64;

/**
 * Read the stored choices. Anything that is not a JSON object of booleans reads as "nothing saved".
 * @param {string | null | undefined} raw
 * @returns {RailSaved}
 */
export function parseSaved(raw) {
  if (typeof raw !== "string" || raw.length === 0) return {};
  let v;
  try { v = JSON.parse(raw); } catch { return {}; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  /** @type {RailSaved} */
  const out = Object.create(null);
  // debt #D113: a hand-edited or hostile entry holding thousands of keys is read up to a cap, never walked whole.
  let n = 0;
  for (const [k, b] of Object.entries(v)) {
    if (n >= SAVED_MAX) break;
    if (typeof b === "boolean" && usableKey(k)) { out[k] = b; n++; }
  }
  return out;
}

/**
 * Write the choices for storage.
 * @param {RailSaved} saved
 * @returns {string}
 */
export function serializeSaved(saved) {
  return JSON.stringify(parseSaved(JSON.stringify(saved && typeof saved === "object" ? saved : {})));
}
