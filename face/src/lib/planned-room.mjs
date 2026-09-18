// planned-room.mjs -- what every PLANNED room folds the same way (face v2 Phase 03, money ring, ADR-1306,
// ADR-1328).
//
// ops, trader and discover are rooms for lanes that are not born. v0.7 drew them as working rooms with write
// flows; arc has no such lanes, and a manifest is never invented for an unborn lane. So a planned room is
// drawn from the planned-rooms registry the door allow-lists (/api/file/planned-rooms): its planned line, what
// the repo already shows for it, what it seals, and what takes it over -- dotted, and every flow it rehearses
// says REHEARSAL (registry.rehearsal) and writes nothing.
//
// F3 (Cycle 15 room sweep): trader wore `● LIVE` because a company-wide kind it homes had fired -- the pill
// measured the kinds, not whether the room exists. Nothing here reads whether a kind fired, and nothing here
// can say LIVE: the badge is fixed, and the kinds the registry homes in a planned room are NAMED as the
// company's, never counted as the room's own.
//
// The same rules as lane-room.mjs, applied here: the body is read ONCE into a copy before it is judged, a 200
// that is not the file asked for is a refusal with a code, the read is made only if the manifest the host
// hands the fold allows it (and a fold handed no manifest reads nothing), and a list this shell cannot read in
// full is named -- its figure unread, never a short number (money ring attack).
import { payloadOf, readProblem } from "./registry.mjs";
import { unescapeDoorText } from "./door.mjs";
import { fmtInt } from "./inbox.mjs";
import { heldBy } from "./lane-room.mjs";

/** The allow-listed id of the planned-rooms registry (arc-dash FILE_ALLOW). */
export const PLANNED_FILE = "planned-rooms";

/** The one badge a planned room wears. It says what the room IS, and it is never a liveness reading. */
export const PLANNED_BADGE = "planned · drawn dotted · rehearsal only";

/** A room id as the served registry writes one. */
const ROOM_ID = /^[a-z0-9][a-z0-9-]*$/;

/** A sha256 as the door writes it. */
const SHA256 = /^[0-9a-f]{64}$/;

/** Characters that render as nothing: the zero-width space and joiners, the word joiner, the BOM, the soft hyphen. */
const INVISIBLE = /[​-‍⁠﻿­]/g;

/**
 * A seal that names a word the room must never print -- planned-rooms.json writes `"WIN (the word)"`. Matched
 * after compatibility normalisation, with invisible characters removed and spaces collapsed, in round or square
 * brackets, anywhere in the seal: one exact spelling let "WIN (the word)." and a full-width bracket print the word
 * (money ring attack).
 */
const THE_WORD = /[([]\s*the\s+word\s*[)\]]/i;

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/**
 * @typedef {import("./registry.mjs").Payload} Payload
 * @typedef {import("./registry.mjs").Read} Read
 * @typedef {import("./registry.mjs").FoldContext} FoldContext
 *
 * @typedef {object} PlannedRoom
 * @property {string} sentence
 * @property {string} lede
 * @property {true} isPlanned
 * @property {true} isDotted
 * @property {true} showRehearsal
 * @property {string} badge
 * @property {string} banner
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {boolean} isRead
 * @property {{ code: string, human: string }} refusal
 * @property {{ key: string, name: string }[]} line
 * @property {boolean} hasLine
 * @property {string[]} showsToday
 * @property {boolean} hasShowsToday
 * @property {string[]} seals
 * @property {boolean} hasSeals
 * @property {{ line: boolean, showsToday: boolean, seals: boolean, kinds: boolean }} unread  which lists could not be read in full
 * @property {string} source
 * @property {string} takesOver
 * @property {string} note          what the planned row carried that this shell could not read
 * @property {boolean} hasNote
 * @property {string} provenance    the file, its hash and its size, as the door served it
 * @property {string[]} kinds       the kinds the served registry homes in this room
 * @property {string} kindsSentence why none of them is counted as this room's
 * @property {Read[]} reads
 */

/** @param {unknown} v @returns {Record<string, unknown>} */
const asObject = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});

/**
 * A string from the parsed file as a person reads it. The file's text was un-escaped ONCE, before it was parsed;
 * un-escaping each string again turned a literal `&lt;b&gt;` into a tag (money ring attack, the kernel ring's
 * "decoded once" rule, again).
 * @param {unknown} v
 * @returns {string | null}
 */
function plain(v) {
  if (typeof v !== "string") return null;
  const t = v.normalize("NFKC").replace(INVISIBLE, "").trim();
  return t === "" ? null : t;
}

/**
 * A list of names from the planned row, read once: the readable entries kept, and whether any was not.
 * @param {unknown} v
 * @returns {{ items: string[], damaged: boolean }}
 */
function namesOf(v) {
  if (v === undefined) return { items: [], damaged: false };
  if (!Array.isArray(v)) return { items: [], damaged: true };
  /** @type {string[]} */
  const items = [];
  for (const x of v) {
    const t = plain(x);
    if (t !== null) items.push(t);
  }
  return { items, damaged: items.length !== v.length };
}

/** @param {string} code @param {string} human */
function refused(code, human) {
  return { isReading: false, isRefused: true, refusal: { code: String(code), human: String(human) } };
}

/**
 * The shared half of a planned room's fold.
 * @param {Record<string, Payload>} payloads
 * @param {FoldContext} ctx
 * @returns {PlannedRoom}
 */
export function plannedRoom(payloads, ctx) {
  const room = asObject(ctx.room);
  const rawId = room["id"];
  // A planned row is matched by the room's id, so the id must BE a room id: an empty one matched a row whose
  // `room` was "" (money ring attack).
  const id = typeof rawId === "string" && ROOM_ID.test(rawId) ? rawId : "";
  /** @type {Read[]} */
  const reads = [];
  const read = { route: "/api/file/:id", param: PLANNED_FILE };
  const why = readProblem(read, ctx.manifest);
  if (why === null) reads.push(read);
  const p = why === null ? payloadOf(payloads, read) : null;

  // Read ONCE into a copy, then judged and drawn from the copy.
  const body = p !== null && p.state === "ok" ? asObject(p.data) : {};
  const servedId = body["id"];
  const path = typeof body["path"] === "string" ? unescapeDoorText(body["path"]) : "";
  const shaRaw = body["sha256"];
  const sha = typeof shaRaw === "string" && SHA256.test(shaRaw) ? shaRaw : "";
  const text = typeof body["text"] === "string" ? body["text"] : null;

  /** @type {{ isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } }} */
  let state = { isReading: false, isRefused: false, refusal: NO_REFUSAL };
  /** @type {Record<string, unknown> | null} */
  let row = null;
  if (why !== null) state = refused("READ_REFUSED", why);
  else if (p === null || p.state === "loading" || p.state === "pending") state = { isReading: true, isRefused: false, refusal: NO_REFUSAL };
  else if (p.state === "refused") state = refused(p.code, p.human);
  // The door always names the file it served; a body naming none, or another, is not this file (money ring attack).
  else if (servedId !== PLANNED_FILE)
    state = refused("WRONG_FILE", `this room asked the door for ${PLANNED_FILE} and the body it answered with is ${typeof servedId === "string" ? servedId : "unnamed"}`);
  else if (text === null || path === "" || sha === "")
    state = refused("BAD_BODY", "the door answered, but not with a file: no path, hash or text");
  else if (id === "")
    state = refused("NO_ROOM_ID", "this room has no room id to find its planned row by");
  else {
    // The door serves a file's text escaped, like every string it sends; the JSON is the text un-escaped ONCE.
    let parsed = null;
    try { parsed = JSON.parse(unescapeDoorText(text)); } catch { parsed = null; }
    const list = asObject(parsed)["rooms"];
    const rows = Array.isArray(list) ? /** @type {unknown[]} */ (list) : null;
    if (rows === null) state = refused("BAD_BODY", "the planned-rooms file the door served is not the registry's JSON: no rooms list in it");
    else {
      const objects = rows.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r)).map(asObject);
      const unreadRows = rows.length - objects.length;
      const hits = objects.filter((r) => r["room"] === id);
      if (hits.length > 1) state = refused("TWO_PLANNED_ROWS", `the planned-rooms registry holds ${fmtInt(hits.length)} rows for ${id}, and choosing one of them would be a guess`);
      else if (hits.length === 0 && unreadRows > 0)
        state = refused("UNREAD_PLANNED_ROWS", `no readable row of the planned-rooms registry is ${id}'s, and ${fmtInt(unreadRows)} row${unreadRows === 1 ? " is" : "s are"} not rows this shell can read -- so its row may be among them`);
      else if (hits.length === 0) state = refused("NO_PLANNED_ROW", `the planned-rooms registry holds no row for ${id}, so there is no planned line to draw`);
      else row = hits[0] ?? null;
    }
  }

  const r = row ?? {};
  const line = namesOf(r["line"]);
  const shows = namesOf(r["shows_today"]);
  const seals = namesOf(r["seals"]);
  // The kinds are the SERVED REGISTRY's, read the way every room reads its holds (lane-room.mjs heldBy): a list
  // carried unreadably is named, and never read as "homes no kind" (money ring attack).
  const held = heldBy(ctx.room);
  const kinds = held.lists["kinds"] ?? [];
  const kindsUnread = held.unreadable.includes("kinds") || held.unreadable.includes("holds");
  const damaged = [["line", line], ["shows_today", shows], ["seals", seals]].filter(([, v]) => /** @type {{ damaged: boolean }} */ (v).damaged).map(([k]) => String(k));
  const lines = text === null || text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  const source = plain(r["source"]);
  const takesOver = plain(r["takes_over"]);

  return {
    // The shell decoded the served registry once; decoding it again would manufacture a `<` (Phase 03 attack).
    sentence: String(room["sentence"] ?? ""),
    lede: String(room["lede"] ?? ""),
    isPlanned: true,
    isDotted: true,
    showRehearsal: true,
    badge: PLANNED_BADGE,
    banner: "Planned, and drawn dotted: this lane is not born, and no manifest is invented for a lane that is not. Every flow below is REHEARSAL and writes nothing.",
    ...state,
    isRead: row !== null,
    line: line.items.map((name, i) => ({ key: `${i}:${name}`, name })),
    hasLine: line.items.length > 0,
    showsToday: shows.items,
    hasShowsToday: shows.items.length > 0,
    // A seal that names a word the room must never print is drawn as that rule, not as the word.
    seals: seals.items.map((s) => (THE_WORD.test(s.replace(/\s+/g, " ")) ? "the word — never rendered" : s)),
    hasSeals: seals.items.length > 0,
    unread: { line: line.damaged, showsToday: shows.damaged, seals: seals.damaged, kinds: kindsUnread },
    source: source ?? "",
    takesOver: takesOver ?? "",
    note: damaged.length === 0 ? "" : `the planned row carried ${damaged.join(", ")} in a shape this shell could not read in full; what could be read is drawn, and its count reads as unread`,
    hasNote: damaged.length > 0,
    provenance: row === null ? "" : `${path} · sha256 ${sha.slice(0, 12)} · ${fmtInt(lines)} line${lines === 1 ? "" : "s"}`,
    kinds,
    kindsSentence: kindsUnread
      ? "The served registry carried this room's kinds in a shape this shell could not read, so which kinds it will own is unread here -- not none."
      : kinds.length === 0
        ? "The served registry homes no receipt kind in this room."
        : `The served registry homes ${kinds.join(", ")} here. ${kinds.length === 1 ? "It fires" : "They fire"} across the company, so none of it is counted as this room's until the lane is born and its manifest takes over.`,
    reads,
  };
}

/**
 * One figure on a planned room's instrument strip, counted from the planned row: unread until the row is read, the
 * refusal's code when it could not be, and unread again when the list itself was carried in a shape this shell
 * could not read in full -- never a short number nobody served (money ring attack). Never a count of receipts: the
 * kinds a planned room will own fire across the company, and none of them is its own.
 * @param {PlannedRoom} base @param {string} key @param {string} label
 * @param {"line" | "showsToday" | "seals"} list @param {string} sub
 * @returns {{ key: string, v: string, l: string, sub: string }}
 */
export function plannedFigure(base, key, label, list, sub) {
  const n = list === "line" ? base.line.length : list === "showsToday" ? base.showsToday.length : base.seals.length;
  if (!base.isRead) return { key, v: "—", l: label, sub: base.isRefused ? base.refusal.code : "reading the planned row" };
  if (base.unread[list]) return { key, v: "—", l: label, sub: "the planned row carried it unreadably" };
  return { key, v: fmtInt(n), l: label, sub };
}

/**
 * The count of kinds a planned room will own, unread when the registry carried them unreadably.
 * @param {PlannedRoom} base
 * @returns {{ key: string, v: string, l: string, sub: string }}
 */
export function plannedKinds(base) {
  return base.unread.kinds
    ? { key: "kinds", v: "—", l: "Kinds it will own", sub: "the registry's kinds were not read" }
    : { key: "kinds", v: fmtInt(base.kinds.length), l: "Kinds it will own", sub: "company-wide · none counted here" };
}
