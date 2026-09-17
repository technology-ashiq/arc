// lane-room.mjs -- what every lane-owned room folds the same way (face v2 Phase 03, kernel ring onward,
// ADR-1320, ADR-1324).
//
// A lane room is a room the served registry gives a lane: its own PROGRESS header and phase specs
// through /api/lane/:id, the receipts of the kinds the registry homes in it through /api/spine, what it
// holds (lints, hooks, jobs, processes, concepts, its ADR century) from /api/rooms, and -- where the door
// allow-lists one -- the file its parsed tables will come from, through /api/file/:id. Each module's fold
// composes this and adds its own panels; a parsed table the door does not serve yet is NOT SERVED under
// the route modules-v2.json plans for it, never a constant.
import { payloadOf } from "./registry.mjs";
import { unescapeDoorText } from "./door.mjs";
import { decodeDoorText, fmtInt, timeOfDay } from "./inbox.mjs";
import { LANE_UNREAD, RECEIPT_CLOSED, holdsList, laneCard, receiptView, trailRead, trailView } from "./spine.mjs";

/** How many receipts a lane room's trail draws. */
export const TRAIL_ROWS = 8;

/**
 * The registry's holds a lane room lists, in the order a reader wants them, with the words for each.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const HOLD_GROUPS = Object.freeze([
  ["jobs", "jobs on the clock"],
  ["processes", "processes"],
  ["commands", "commands"],
  ["hooks", "hooks"],
  ["lints", "lints"],
  ["products", "products"],
  ["concepts", "concepts"],
]);

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
 * @typedef {object} LaneRoom
 * @property {string} sentence
 * @property {string} lede
 * @property {string} laneName
 * @property {PanelState & { isDrawn: boolean, card: LaneCard }} lane
 * @property {{ isHomed: boolean, isPartial: boolean, isDrawn: boolean, isReading: boolean, isRefused: boolean, refusal: { code: string, human: string }, rows: EventRowView[], hint: string, empty: string, count: number, events: FeedEvent[] }} trail
 * @property {ReceiptView} receipt
 * @property {{ key: string, label: string, items: string }[]} holds
 * @property {boolean} hasHolds
 * @property {string} century
 * @property {SourceFile[]} sources
 * @property {Read[]} reads
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/** @param {Payload} p @returns {PanelState} */
function panelState(p) {
  return {
    isReading: p.state === "loading" || p.state === "pending",
    isRefused: p.state === "refused",
    refusal: p.state === "refused" ? { code: p.code, human: p.human } : NO_REFUSAL,
  };
}

/** @param {unknown} v @returns {Record<string, unknown>} */
const asObject = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});

/**
 * One allow-listed file as the door served it: where it lives, its hash, and its size in lines -- the
 * provenance of a table this room will draw once its route exists. Never its content as a table.
 * @param {string} id @param {Payload} p
 * @returns {SourceFile}
 */
export function sourceFile(id, p) {
  const state = panelState(p);
  const body = p.state === "ok" ? asObject(p.data) : {};
  const path = typeof body["path"] === "string" ? decodeDoorText(body["path"]) : "";
  const sha = typeof body["sha256"] === "string" && /^[0-9a-f]{64}$/.test(body["sha256"]) ? body["sha256"] : "";
  const text = typeof body["text"] === "string" ? body["text"] : null;
  const isRead = p.state === "ok" && path !== "" && sha !== "" && text !== null;
  const lines = text === null ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  return {
    id,
    ...state,
    // A 200 whose body is not a file is a refusal of its own, named, not a blank card.
    isRefused: state.isRefused || (p.state === "ok" && !isRead),
    refusal: p.state === "ok" && !isRead ? { code: "BAD_BODY", human: "the door answered, but not with a file: no path, hash or text" } : state.refusal,
    isRead,
    path,
    sha: isRead ? `sha256 ${sha.slice(0, 12)}` : "",
    size: isRead ? `${fmtInt(lines)} line${lines === 1 ? "" : "s"}` : "",
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

  const laneName = holdsList(room, "lanes")[0] ?? "";
  const laneRead = laneName === "" ? null : { route: "/api/lane/:id", param: laneName, poll: true };
  if (laneRead !== null) reads.push(laneRead);
  const laneP = laneRead === null ? null : payloadOf(payloads, laneRead);
  const card = laneP !== null && laneP.state === "ok" ? laneCard(laneP.data) : LANE_UNREAD;
  const laneState = laneP === null
    ? { isReading: false, isRefused: true, refusal: { code: "NO_LANE", human: "the served registry names no lane for this room" } }
    : panelState(laneP);

  const kinds = holdsList(room, "kinds");
  const tRead = trailRead(kinds);
  if (tRead !== null) reads.push(tRead);
  const trailP = tRead === null ? null : payloadOf(payloads, tRead);
  const trail = trailP !== null && trailP.state === "ok" ? trailView(trailP.data, TRAIL_ROWS) : null;
  const trailState = trailP === null ? { isReading: false, isRefused: false, refusal: NO_REFUSAL } : panelState(trailP);

  const files = (opts.files ?? []).filter((f) => typeof f === "string" && f !== "");
  /** @type {SourceFile[]} */
  const sources = files.map((id) => {
    const read = { route: "/api/file/:id", param: id };
    reads.push(read);
    return sourceFile(id, payloadOf(payloads, read));
  });

  const adrs = holdsList(room, "adrs").filter((a) => /^\d{4}$/.test(a));
  const events = trail === null ? [] : trail.events;
  const pickedReceipt = typeof picks.receipt === "string" ? picks.receipt : "";

  return {
    sentence: decodeDoorText(room.sentence),
    lede: decodeDoorText(room.lede),
    laneName,
    lane: { ...laneState, isDrawn: !laneState.isRefused, card },
    trail: {
      isHomed: tRead !== null,
      isPartial: trail !== null && trail.more,
      isDrawn: !trailState.isReading && !trailState.isRefused,
      ...trailState,
      rows: trail === null ? [] : trail.rows,
      hint: tRead === null ? "this room homes no receipt kind" : trail === null ? `receipts of ${kinds.join(", ")}` : trail.hint,
      empty: tRead === null
        ? (opts.trailEmpty ?? "The served registry homes no receipt kind in this room, so it has no trail of its own.")
        : `No receipt of ${kinds.join(", ")} on the spine the door reads.`,
      count: trail === null ? 0 : trail.count,
      events,
    },
    receipt: pickedReceipt === "" ? RECEIPT_CLOSED : receiptView(events, pickedReceipt),
    holds: HOLD_GROUPS
      .map(([key, label]) => ({ key, label, list: holdsList(room, key) }))
      .filter((g) => g.list.length > 0)
      .map((g) => ({ key: g.key, label: g.label, items: g.list.join(" · ") })),
    hasHolds: HOLD_GROUPS.some(([key]) => holdsList(room, key).length > 0),
    century: adrs.length === 0 ? "" : adrs.map((a) => `ADR-${a.slice(0, 2)}00 to ADR-${a.slice(0, 2)}99`).join(" · "),
    sources,
    reads,
  };
}

/**
 * Receipts of one kind among the trail's, counted; a trail the door has not served counts as unread.
 * @param {LaneRoom} base @param {string} kind
 * @returns {string}
 */
export function kindCount(base, kind) {
  if (!base.trail.isHomed || base.trail.isReading || base.trail.isRefused) return "—";
  const n = fmtInt(base.trail.events.filter((e) => e.kind === kind).length);
  return base.trail.isPartial ? `${n}+` : n;
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
 * newest first: how many ran, and how the last one ended. A receipt without that field is not guessed
 * into a group.
 * @param {FeedEvent[]} events @param {string} field @param {string[]} detailFields
 * @returns {RunRow[]}
 */
export function runsBy(events, field, detailFields) {
  /** @type {Map<string, { runs: number, last: FeedEvent }>} */
  const groups = new Map();
  for (const e of events) {
    if (e.kind !== "run.completed") continue;
    const v = e.payload[field];
    if (typeof v !== "string" || v === "") continue;
    const had = groups.get(v);
    // The door pages oldest first, so the later receipt of a group is its last run.
    groups.set(v, { runs: (had === undefined ? 0 : had.runs) + 1, last: e });
  }
  return [...groups.entries()]
    .sort((a, b) => (a[1].last.ts < b[1].last.ts ? 1 : a[1].last.ts > b[1].last.ts ? -1 : 0))
    .map(([name, g]) => {
      const p = g.last.payload;
      const outcome = g.last.outcome !== "" ? g.last.outcome : typeof p["outcome"] === "string" ? p["outcome"] : "";
      return {
        key: name,
        name: unescapeDoorText(name),
        runs: `${fmtInt(g.runs)} run${g.runs === 1 ? "" : "s"}`,
        last: outcome === "" ? "no outcome recorded" : `last ${unescapeDoorText(outcome)}`,
        when: `${g.last.day} ${timeOfDay(g.last.ts)}`.trim(),
        detail: detailFields
          .map((k) => /** @type {[string, unknown]} */ ([k, p[k]]))
          .filter(([, v]) => (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v)))
          .map(([k, v]) => `${k} ${typeof v === "string" ? unescapeDoorText(v) : String(v)}`)
          .join(" · "),
      };
    });
}

/**
 * The head's right-hand label: the lane and its header's status, or what is still being read.
 * @param {LaneRoom} base
 * @returns {string}
 */
export function laneBadge(base) {
  if (base.laneName === "") return "no lane in the registry";
  if (base.lane.isRefused) return `${base.laneName} lane · not read`;
  return base.lane.card.isRead ? `${base.laneName} lane · ${base.lane.card.status}` : `${base.laneName} lane · reading`;
}

/**
 * The lane's figure on the instrument strip.
 * @param {LaneRoom} base
 * @returns {{ key: string, v: string, l: string, sub: string }}
 */
export function laneKpi(base) {
  return {
    key: "lane",
    v: base.lane.card.isRead ? base.lane.card.status : "—",
    l: base.laneName === "" ? "Lane" : `The ${base.laneName} lane`,
    sub: base.lane.card.isRead ? base.lane.card.phase : base.lane.isRefused ? "the door refused the lane" : "reading its header",
  };
}

/**
 * A holds list's size as a figure.
 * @param {FoldContext} ctx @param {string} key
 * @returns {string}
 */
export function holdsCount(ctx, key) {
  return fmtInt(holdsList(ctx.room, key).length);
}

/**
 * Whether a link to another room can be followed: only to a room the door serves.
 * @param {FoldContext} ctx @param {string} id
 * @returns {{ canOpen: boolean, room: string }}
 */
export function roomLink(ctx, id) {
  const served = (ctx.rooms || []).some((r) => r.id === id);
  return { canOpen: served, room: served ? id : "" };
}
