// lane-room.mjs -- what every lane-owned room folds the same way (face v2 Phase 03, kernel ring onward,
// ADR-1320, ADR-1324).
//
// A lane room is a room the served registry gives a lane: its own PROGRESS header and phase specs
// through /api/lane/:id, the receipts of the kinds the registry homes in it through /api/spine, what it
// holds (its lints, hooks, jobs, processes, concepts and ADR century) from the registry the shell already
// read, and -- where the door allow-lists one -- the file its parsed tables will come from, through
// /api/file/:id. Each module's fold composes this and adds its own panels; a parsed table the door does
// not serve yet is NOT SERVED under the route modules-v2.json plans for it, never a constant.
//
// What the Phase 03 attackers taught this file, each rule written where it is applied:
//   - every door body is READ ONCE into a plain copy before it is judged, because the value judged and
//     the value drawn must be the same bytes (registry.mjs's snapshotRead, made again here);
//   - a 200 that is not the thing asked for is a REFUSAL with a code, never a card that reads
//     "reading…" for ever, and never a card about another lane or another file;
//   - a page the door says has more past it is PARTIAL: nothing derived from it is presented as
//     complete -- not a count, not a last fire, not "all time";
//   - a registry value this shell cannot use is NAMED, never silently dropped: a kind it cannot ask
//     for, a lane name it cannot request, an ADR band it cannot read, a second lane it did not draw;
//   - what the registry never carried and what it carried unreadably are different sentences.
import { payloadOf } from "./registry.mjs";
import { unescapeDoorText } from "./door.mjs";
import { fmtInt, timeOfDay } from "./inbox.mjs";
import { LANE_UNREAD, RECEIPT_CLOSED, laneCard, receiptView, trailRead, trailView } from "./spine.mjs";

/** How many receipts a lane room's trail draws. */
export const TRAIL_ROWS = 8;

/** A lane name the door will accept: the lane grammar, which `lane-resolve` enforces on its side. */
const LANE_NAME = /^[a-z][a-z0-9-]{0,63}$/;

/** A spine kind this shell can ask the door for. A comma would widen the ask; a space would narrow it. */
const KIND_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** A receipt timestamp this shell can read a clock out of. */
const TS_HEAD = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A sha256 as the door writes it. */
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * The holds this panel does NOT list, because the room draws each of them somewhere better: its kinds
 * are the trail, its lane is the lane card, its ADRs are the century line. Every OTHER key the served
 * registry homes in a room is listed under its own name -- derived from the registry rather than named
 * here, so a new kind of thing a room holds appears the day the registry carries it, and no shell file
 * has to name a room to show it.
 */
const HOLDS_DRAWN_ELSEWHERE = Object.freeze(["kinds", "lanes", "adrs"]);

/**
 * @typedef {import("./registry.mjs").Payload} Payload
 * @typedef {import("./registry.mjs").Read} Read
 * @typedef {import("./registry.mjs").FoldContext} FoldContext
 * @typedef {import("./spine.mjs").LaneCard} LaneCard
 * @typedef {import("./spine.mjs").EventRowView} EventRowView
 * @typedef {import("./spine.mjs").ReceiptView} ReceiptView
 * @typedef {import("./inbox.mjs").FeedEvent} FeedEvent
 *
 * @typedef {object} PanelState
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 *
 * @typedef {object} SourceFile
 * @property {string} id
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {boolean} isRead
 * @property {{ code: string, human: string }} refusal
 * @property {string} path
 * @property {string} sha
 * @property {string} size
 *
 * @typedef {object} Trail
 * @property {boolean} isHomed      the registry homes at least one kind this shell can ask for
 * @property {boolean} isPartial    the door said there are receipts past the page it sent
 * @property {boolean} isDrawn      the rows below are what the door sent, and may be drawn
 * @property {boolean} showEmpty    the door answered and the page held no receipt of these kinds
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {EventRowView[]} rows
 * @property {FeedEvent[]} events
 * @property {string[]} kinds       the kinds actually asked for
 * @property {string} hint
 * @property {string} empty
 * @property {string} note          what the registry carried that this shell could not ask for
 * @property {number} count
 *
 * @typedef {object} LaneRoom
 * @property {string} sentence
 * @property {string} lede
 * @property {string} laneName
 * @property {boolean} hasLane     the served registry homes a lane in this room
 * @property {string} laneAbsent   why there is no lane card, when there is none
 * @property {PanelState & { isDrawn: boolean, card: LaneCard, note: string, absent: string }} lane
 * @property {Trail} trail
 * @property {ReceiptView} receipt
 * @property {Record<string, string[]>} held
 * @property {{ key: string, label: string, items: string }[]} holds
 * @property {boolean} hasHolds
 * @property {string} holdsNote    what the registry carried here that this shell could not read
 * @property {string[]} unreadable the keys behind that note
 * @property {string} century
 * @property {SourceFile[]} sources
 * @property {Read[]} reads
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/** @param {unknown} v @returns {string | null} */
const asText = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** @param {unknown} v @returns {unknown[]} */
const asArrayOf = (v) => (Array.isArray(v) ? v : []);

/** @param {unknown} v @returns {Record<string, unknown>} */
const asObject = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});

/** @param {Payload} p @returns {PanelState} */
function panelState(p) {
  return {
    isReading: p.state === "loading" || p.state === "pending",
    isRefused: p.state === "refused",
    refusal: p.state === "refused" ? { code: p.code, human: p.human } : NO_REFUSAL,
  };
}

/** @param {string} code @param {string} human @returns {PanelState} */
const refusedBy = (code, human) => ({ isReading: false, isRefused: true, refusal: { code, human } });

/**
 * What a room holds, read ONCE into a plain copy: every list snapshotted, every value taken from an own
 * key. A getter on the served registry cannot answer one thing to the check and another to the screen,
 * and a fold that reads `holds` twenty times reads one copy twenty times.
 * @param {unknown} room
 * @returns {{ lists: Record<string, string[]>, unreadable: string[] }}
 */
export function heldBy(room) {
  const holds = asObject(asObject(room)["holds"]);
  /** @type {Record<string, string[]>} */
  const lists = Object.create(null);
  /** @type {string[]} */
  const unreadable = [];
  for (const key of Object.keys(holds)) {
    // A key named after an object's own machinery is not a kind of thing a room holds.
    if (key === "__proto__" || key === "constructor" || key === "prototype") { unreadable.push(key); continue; }
    const value = holds[key];
    if (!Array.isArray(value)) { unreadable.push(key); continue; }
    const list = [];
    // An entry that renders as nothing -- empty, or only spaces and zero-width characters -- is not a
    // thing arc holds; counting it inflates every figure derived from this list (Phase 03 attack).
    for (const item of value) if (typeof item === "string" && unescapeDoorText(item).trim() !== "") list.push(unescapeDoorText(item).trim());
    // A list that lost an element is kept -- the names that ARE readable are still worth drawing -- but the
    // key is marked, so its count reads as unread rather than as a short number nobody served (code review).
    if (list.length !== value.length) unreadable.push(key);
    lists[key] = list;
  }
  return { lists, unreadable };
}

/** @param {Record<string, string[]>} lists @param {string} key @returns {string[]} */
const listOf = (lists, key) => (Object.hasOwn(lists, key) ? lists[key] ?? [] : []);

/**
 * One allow-listed file as the door served it: where it lives, its hash, and its size in lines -- the
 * provenance of a table this room will draw once its route exists. Never its content as a table, and
 * never another file's provenance under the id this room asked for.
 * @param {string} id @param {Payload} p
 * @returns {SourceFile}
 */
export function sourceFile(id, p) {
  const state = panelState(p);
  if (p.state !== "ok") return { id, ...state, isRead: false, path: "", sha: "", size: "" };
  // Every field read once, then judged and drawn from the copy.
  const body = asObject(p.data);
  const servedId = body["id"];
  const path = typeof body["path"] === "string" ? unescapeDoorText(body["path"]) : "";
  const shaRaw = body["sha256"];
  const sha = typeof shaRaw === "string" && SHA256.test(shaRaw) ? shaRaw : "";
  const text = typeof body["text"] === "string" ? body["text"] : null;
  if (typeof servedId === "string" && servedId !== id)
    return { id, ...refusedBy("WRONG_FILE", `this room asked the door for ${id} and the body it answered with is ${servedId}`), isRead: false, path: "", sha: "", size: "" };
  if (path === "" || sha === "" || text === null)
    return { id, ...refusedBy("BAD_BODY", "the door answered, but not with a file: no path, hash or text"), isRead: false, path: "", sha: "", size: "" };
  // An empty file is 0 lines. Counting the tail of a split as a line reports a measurement of nothing as one.
  const lines = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  return {
    id, ...state, isRefused: false, isRead: true, path,
    sha: `sha256 ${sha.slice(0, 12)}`,
    size: `${fmtInt(lines)} line${lines === 1 ? "" : "s"}`,
  };
}

/**
 * The shared half of a lane room's fold.
 * @param {Record<string, Payload>} payloads
 * @param {FoldContext} ctx
 * @param {{ files?: string[], trailEmpty?: string }} [opts]
 * @returns {LaneRoom}
 */
export function laneRoom(payloads, ctx, opts = {}) {
  const room = ctx.room;
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {Read[]} */
  const reads = [];
  const { lists, unreadable } = heldBy(room);

  // ── the lane ───────────────────────────────────────────────────────────────────────────────────
  const lanes = listOf(lists, "lanes");
  const laneName = lanes[0] ?? "";
  const laneUsable = LANE_NAME.test(laneName);
  // NOT polled: the door answers this route with PROGRESS.md, PLAN.md and every phase spec's text --
  // hundreds of kilobytes for a header and a list of titles. The trail is what moves; the header is read
  // once per open, and the shell's re-read control takes it again (code review).
  const laneRead = laneUsable ? { route: "/api/lane/:id", param: laneName } : null;
  if (laneRead !== null) reads.push(laneRead);
  const laneP = laneRead === null ? null : payloadOf(payloads, laneRead);
  const card = laneP !== null && laneP.state === "ok" ? laneCard(laneP.data) : LANE_UNREAD;
  const laneState = laneName === ""
    // Not a refusal: the council chamber and review-and-ship are rooms the registry gives no lane, and
    // "there is no lane here" is a different sentence from "the lane could not be read" (factory ring).
    ? { isReading: false, isRefused: false, refusal: NO_REFUSAL }
    : !laneUsable
      ? refusedBy("BAD_LANE_NAME", `the served registry names ${JSON.stringify(laneName)} as this room's lane, which is not a name the door will take`)
      : laneP === null
        ? refusedBy("NO_LANE", "the served registry names no lane for this room")
        // A 200 that is not a lane, or is another lane, is a refusal with a code -- not a card that
        // reads "reading the lane…" for ever (Phase 03 attack).
        : laneP.state === "ok" && !card.isRead
          ? refusedBy("BAD_BODY", `the door answered for ${laneName}, but not with a lane: no lane name in the body it sent`)
          : laneP.state === "ok" && card.lane !== laneName
            ? refusedBy("WRONG_LANE", `this room asked the door for ${laneName} and the body it answered with is ${card.lane}`)
            : panelState(laneP);

  // ── the trail ──────────────────────────────────────────────────────────────────────────────────
  const homedKinds = listOf(lists, "kinds");
  const kinds = homedKinds.filter((k) => KIND_NAME.test(k));
  const rejectedKinds = homedKinds.filter((k) => !KIND_NAME.test(k));
  const tRead = trailRead(kinds);
  if (tRead !== null) reads.push(tRead);
  const trailP = tRead === null ? null : payloadOf(payloads, tRead);
  // A body with no events ARRAY is a page this shell cannot read, and "empty because unreadable" is not
  // "empty because nothing happened" -- the reader coerces either into zero rows, so the shape is checked
  // before the count becomes a sentence about the spine (Phase 03 attack).
  const trailBadBody = trailP !== null && trailP.state === "ok" && !Array.isArray(asObject(trailP.data)["events"]);
  // A page carrying a kind this room did not ask for is not this room's trail: WRONG_LANE and
  // WRONG_FILE were built for the other two bodies, and the spine body -- the one that fills every
  // ring room's trail -- had no equivalent (Phase 03 attack).
  const foreign = trailP !== null && trailP.state === "ok" && !trailBadBody
    ? [...new Set(asArrayOf(asObject(trailP.data)["events"]).map((w) => asText(asObject(asObject(w)["event"])["kind"]) ?? "").filter((k) => k !== "" && !kinds.includes(k)))]
    : [];
  const trail = trailP !== null && trailP.state === "ok" && !trailBadBody && foreign.length === 0 ? trailView(trailP.data, TRAIL_ROWS) : null;
  const trailState = trailP === null
    ? { isReading: false, isRefused: false, refusal: NO_REFUSAL }
    : trailBadBody
      ? refusedBy("BAD_BODY", "the door answered, but not with a page of receipts: no events list in the body it sent")
      : foreign.length > 0
        ? refusedBy("WRONG_KINDS", `this room asked for ${kinds.join(", ")} and the page it answered with carries ${foreign.join(", ")}`)
        : panelState(trailP);
  const kindWord = kinds.join(", ");

  // ── the files ──────────────────────────────────────────────────────────────────────────────────
  const files = (opts.files ?? []).filter((f) => typeof f === "string" && f !== "");
  /** @type {SourceFile[]} */
  const sources = files.map((id) => {
    const read = { route: "/api/file/:id", param: id };
    reads.push(read);
    return sourceFile(id, payloadOf(payloads, read));
  });

  // ── what the registry says this room holds ─────────────────────────────────────────────────────
  const adrs = listOf(lists, "adrs");
  const bands = adrs.map((a) => (/^\d{4}$/.test(a) ? `ADR-${a.slice(0, 2)}00 to ADR-${a.slice(0, 2)}99` : `${a} (not a band id)`));
  const holdKeys = Object.keys(lists).filter((k) => !HOLDS_DRAWN_ELSEWHERE.includes(k) && listOf(lists, k).length > 0);
  const events = trail === null ? [] : trail.events;
  const pickedReceipt = typeof picks.receipt === "string" ? picks.receipt : "";

  return {
    // The shell decoded the served registry once (`decodeRegistry`); decoding it again here would
    // manufacture a `<` out of a header that only ever held `&lt;` (Phase 03 attack).
    sentence: String(room.sentence ?? ""),
    lede: String(room.lede ?? ""),
    laneName,
    hasLane: laneName !== "",
    laneAbsent: laneName === "" ? "the served registry homes no lane in this room" : "",
    lane: {
      ...laneState,
      isDrawn: laneName !== "" && !laneState.isRefused,
      // A lane panel over a room the registry gives no lane says so, instead of a titled panel over
      // nothing at all (Phase 03 attack).
      absent: laneName === "" ? "the served registry homes no lane in this room" : "",
      card,
      note: lanes.length > 1 ? `the registry homes ${fmtInt(lanes.length)} lanes in this room (${lanes.join(", ")}); this card is the first` : "",
    },
    trail: {
      isHomed: tRead !== null,
      // A page whose count exceeds the receipts it carries is partial too: a door that truncates without
      // setting `more` must not have its page called the whole truth (Phase 03 attack).
      isPartial: trail !== null && (trail.more || trail.count > trail.events.length),
      isDrawn: tRead !== null && !trailState.isReading && !trailState.isRefused,
      showEmpty: tRead !== null && !trailState.isReading && !trailState.isRefused && (trail === null || trail.rows.length === 0),
      ...trailState,
      rows: trail === null ? [] : trail.rows,
      events,
      kinds,
      hint: tRead === null ? "this room homes no receipt kind" : trail === null ? `receipts of ${kindWord}` : trail.hint,
      empty: tRead === null
        ? (opts.trailEmpty ?? "The served registry homes no receipt kind in this room, so it has no trail of its own.")
        : `No receipt of ${kindWord} on the page the door sent.`,
      note: [
        rejectedKinds.length > 0 ? `the registry homes ${rejectedKinds.length === 1 ? "a kind" : "kinds"} this shell will not ask the door for: ${rejectedKinds.map((k) => JSON.stringify(k)).join(", ")}` : "",
        unreadable.includes("kinds") ? "the registry's kinds for this room are not a list of names, so some of them were not read" : "",
      ].filter((s) => s !== "").join(" · "),
      count: trail === null ? 0 : trail.count,
    },
    receipt: pickedReceipt === "" ? RECEIPT_CLOSED : receiptView(events, pickedReceipt),
    held: lists,
    holds: holdKeys.map((key) => ({ key, label: key, items: listOf(lists, key).join(" · ") })),
    hasHolds: holdKeys.length > 0,
    holdsNote: unreadable.length === 0
      ? ""
      : `the registry carried ${unreadable.length === 1 ? "one list" : `${fmtInt(unreadable.length)} lists`} here this shell could not read in full: ${unreadable.join(", ")}`,
    unreadable,
    century: bands.join(" · "),
    sources,
    reads,
  };
}

/**
 * Receipts of one kind among the trail's, counted. A kind the registry does not home here was never
 * asked for, so its count is unread, not zero; a partial page counts what that page held, and says so.
 * @param {LaneRoom} base @param {string} kind
 * @returns {string}
 */
export function kindCount(base, kind) {
  if (!base.trail.kinds.includes(kind)) return "—";
  if (!base.trail.isDrawn) return "—";
  const n = fmtInt(base.trail.events.filter((e) => e.kind === kind).length);
  return base.trail.isPartial ? `${n}+` : n;
}

/**
 * Does this room ask the door for that kind at all? A figure derived from a kind the registry does not
 * home here was never measured, and is drawn as unread rather than as zero.
 * @param {LaneRoom} base @param {string} kind
 */
export function hasKind(base, kind) {
  return base.trail.kinds.includes(kind);
}

/**
 * What a figure counted from the trail is a figure OF: the page the door sent, and whether more lies
 * past it. Never "all time" -- the door pages from the oldest receipt. Kept short: the instrument strip
 * gives a subtitle two lines, and a sentence longer than that clips (Phase 03 shot re-review).
 * @param {LaneRoom} base @param {string} what
 * @returns {string}
 */
export function countedOn(base, what) {
  if (!base.trail.isHomed) return "the registry homes no such kind here";
  if (base.trail.isRefused) return `${what} · the door refused its receipts`;
  if (!base.trail.isDrawn) return "reading the page";
  return base.trail.isPartial ? `${what} · oldest page, more past it` : `${what} · the page the door sent`;
}

/**
 * @typedef {object} RunRow
 * @property {string} key
 * @property {string} name
 * @property {string} runs
 * @property {string} last
 * @property {string} when
 * @property {string} detail
 */

/**
 * run.completed receipts among a trail's, grouped by one payload field (a job, a process, a driver) and
 * newest first: how many ran on the page the door sent, and how the newest of them ended. A receipt
 * without that field is not guessed into a group, and a timestamp this shell cannot read is named rather
 * than sliced into a clock.
 * @param {FeedEvent[]} events @param {string} field @param {string[]} detailFields @param {boolean} [isPartial]
 * @returns {RunRow[]}
 */
export function runsBy(events, field, detailFields, isPartial = false) {
  /** @type {Map<string, { runs: number, last: FeedEvent }>} */
  const groups = new Map();
  for (const e of events) {
    if (e.kind !== "run.completed") continue;
    const v = e.payload[field];
    if (typeof v !== "string" || v === "") continue;
    // The name is decoded once, here, so the registry's list and the receipts' names compare as the
    // same text (a job called `q&a-roll` was drawn twice before this, Phase 03 attack).
    const name = unescapeDoorText(v);
    const had = groups.get(name);
    // The LAST run is the newest by timestamp, not the last element of the page: a page is not sorted
    // by anything this shell controls.
    const last = had === undefined || newer(e.ts, had.last.ts) ? e : had.last;
    groups.set(name, { runs: (had === undefined ? 0 : had.runs) + 1, last });
  }
  return [...groups.entries()]
    .sort((a, b) => (newer(b[1].last.ts, a[1].last.ts) ? 1 : newer(a[1].last.ts, b[1].last.ts) ? -1 : 0))
    .map(([name, g]) => {
      const p = g.last.payload;
      const outcome = g.last.outcome !== "" ? g.last.outcome : typeof p["outcome"] === "string" ? p["outcome"] : "";
      return {
        key: name,
        name,
        runs: `${fmtInt(g.runs)} run${g.runs === 1 ? "" : "s"}${isPartial ? " on that page" : ""}`,
        last: outcome === "" ? "no outcome recorded" : `last ${unescapeDoorText(outcome)}`,
        when: TS_HEAD.test(g.last.ts) ? `${g.last.day} ${timeOfDay(g.last.ts)}`.trim() : "time unreadable",
        detail: detailFields
          .map((k) => /** @type {[string, unknown]} */ ([k, p[k]]))
          .filter(([, v]) => (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v)))
          .map(([k, v]) => `${k} ${typeof v === "string" ? unescapeDoorText(v) : String(v)}`)
          .join(" · "),
      };
    });
}

/**
 * Is `a` a later timestamp than `b`? Both are compared as the spine writes them, and a timestamp this
 * shell cannot read is never "later" -- it sorts last rather than winning by string order.
 * @param {string} a @param {string} b
 */
function newer(a, b) {
  const okA = TS_HEAD.test(a);
  const okB = TS_HEAD.test(b);
  if (!okA) return false;
  if (!okB) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta > tb;
  return a > b;
}

/**
 * The head's right-hand label: the lane and its header's status, or what is still being read.
 * @param {LaneRoom} base
 * @returns {string}
 */
export function laneBadge(base, whenNoLane = "no lane of its own") {
  if (base.laneName === "") return whenNoLane;
  if (base.lane.isRefused) return `${base.laneName} lane · not read`;
  return base.lane.card.isRead ? `${base.laneName} lane · ${base.lane.card.status}` : `${base.laneName} lane · reading`;
}

/**
 * The lane's figure on the instrument strip.
 * @param {LaneRoom} base
 * @returns {{ key: string, v: string, l: string, sub: string }}
 */
export function laneKpi(base) {
  // isRefused FIRST, exactly as the badge asks it. A body the panel refused as WRONG_LANE still parses,
  // so reading `card.isRead` first drew ANOTHER lane's status in the strip beside the refusal that named
  // it -- two readers of one question, inside one file (Phase 03 attack).
  const drawn = base.lane.isDrawn && !base.lane.isRefused && base.lane.card.isRead;
  return {
    key: "lane-status",
    v: drawn ? base.lane.card.status : "—",
    l: base.laneName === "" ? "Lane" : `The ${base.laneName} lane`,
    sub: drawn
      ? base.lane.card.phase
      : base.lane.isRefused ? base.lane.refusal.code : base.laneName === "" ? base.laneAbsent : "reading its header",
  };
}

/**
 * What every room in the served registry holds under one key, as rows a catalogue can draw: the thing
 * itself, and the room that holds it. This is the registry the shell already read -- no route, no
 * bundle -- and it is how the toolbelt indexes arc without naming a single room in a shell file.
 * @param {FoldContext} ctx @param {string} key
 * @returns {{ rows: { key: string, name: string, room: string, roomName: string, canOpen: boolean }[], unreadable: string[] }}
 */
export function heldAcrossRooms(ctx, key) {
  const out = [];
  const seen = new Set();
  /** @type {string[]} */
  const unreadable = [];
  for (const room of ctx.rooms || []) {
    // EVERY room, including the lane-room template and the planned ones: the template holds four real
    // commands, and dropping it made the catalogue count four fewer than arc has. A row whose room
    // cannot be opened says so through canOpen rather than being left out (factory ring).
    if (!room) continue;
    const id = asText(room.id);
    // A row whose room this shell cannot name is DROPPED and counted, never drawn as "undefined" with a
    // live click handler behind it (Phase 03 attack).
    if (id === null) { unreadable.push("a room with no id"); continue; }
    const { lists, unreadable: bad } = heldBy(room);
    // What a room carried here unreadably is named, so a catalogue that shrank says why.
    if (bad.includes(key)) unreadable.push(id);
    for (const name of listOf(lists, key)) {
      const rowKey = `${name}@${room.id}`;
      if (seen.has(rowKey)) continue;
      seen.add(rowKey);
      const link = roomLink(ctx, id);
      const roomName = asText(room.name) ?? id;
      out.push({ key: rowKey, name, room: link.room, roomName, canOpen: link.canOpen });
    }
  }
  // One alphabet: the find box folds case, so the list is ordered the same way rather than putting
  // ARC-SHIP, Arc-Ship and arc-ship in three places (Phase 03 attack).
  /** @param {string} s */
  const fold = (s) => s.toLowerCase();
  out.sort((a, b) => (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : a.roomName < b.roomName ? -1 : a.roomName > b.roomName ? 1 : 0));
  return { rows: out, unreadable: [...new Set(unreadable)] };
}

/**
 * A holds list's size as a figure, from the copy the fold already took.
 * @param {LaneRoom} base @param {string} key
 * @returns {string}
 */
export function holdsCount(base, key) {
  if (base.unreadable.includes(key)) return "—";
  return fmtInt(listOf(base.held, key).length);
}

/**
 * Whether a link to another room can be followed: only to a room the door serves, that is built and is
 * not the lane-room template -- the same answer the rail gives, rather than a fourth one.
 * @param {FoldContext} ctx @param {string} id
 * @returns {{ canOpen: boolean, room: string }}
 */
export function roomLink(ctx, id) {
  const hit = (ctx.rooms || []).find((r) => r && r.id === id);
  const openable = hit !== undefined && hit.planned !== true && hit.status !== "planned" && hit.template !== true && hit.status !== "template";
  return { canOpen: openable, room: openable ? id : "" };
}
