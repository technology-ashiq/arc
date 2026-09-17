// fold.mjs -- command/map: every decision the map makes, where node can import it with no install
// (face v2 Phase 03, ADR-1320, ADR-1321).
//
// The port of v0.7's MapRoom onto the served registry. A station's state is a fold, never typed in:
// PLANNED when the registry says the room is planned, INDEX when it renders other rooms, LIVE when a
// receipt of a kind it homes fired today (the door's day), QUIET when it has fired before, UNEXERCISED
// when the door says it never has. The lanes come from the contract the shell read; the geometry is
// computed here so the View only places what it is given.
import { payloadOf } from "../../../lib/registry.mjs";
import { dayOf, decodeDoorText, fmtInt, readHealth, readSpinePage, shortId } from "../../../lib/inbox.mjs";
import { eventLine } from "../../../lib/spine.mjs";

const W = 1120;
const ROW_H = 96;
const FEED_LIMIT = 1000;

/** @type {Record<string, string>} each ring's line, one token per ring and no meaning borrowed */
const RING_INK = { command: "var(--accent)", kernel: "var(--blue)", factory: "var(--text-2)", money: "var(--text-2)", company: "var(--text-2)" };

/**
 * @typedef {"live" | "quiet" | "unexercised" | "planned" | "index"} StationState
 *
 * @typedef {object} Station
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} r
 * @property {string} fill
 * @property {string} stroke
 * @property {number} strokeWidth
 * @property {string | undefined} dash
 * @property {string} labelInk
 * @property {string} stateInk
 * @property {string} stateLabel
 * @property {boolean} hasToday
 * @property {string} todayLabel
 *
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {string} viewBox
 * @property {{ ring: string, y: number, labelY: number, ink: string, x0: number, x1: number, stations: (Station & { y: number, nameY: number, stateY: number, countY: number })[] }[]} rows
 * @property {{ key: string, label: string, fill: string, border: string }[]} legend
 * @property {string} feedNote
 * @property {boolean} isFeedRefused
 * @property {{ lane: string, room: string, name: string, ink: string, state: string, stateInk: string, canOpen: boolean }[]} lanes
 * @property {string} lanesHint
 * @property {string} lanesFoot
 * @property {{ isShown: boolean, title: string, ring: string, sentence: string, lede: string, today: string, ever: string, last: string, hasLast: boolean, note: string }} hovered
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, import("../../../lib/registry.mjs").Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [{ route: "/api/health", poll: true }];
  const healthP = payloadOf(payloads, { route: "/api/health" });
  const health = healthP.state === "ok" ? readHealth(healthP.data) : null;
  const day = health === null ? "" : dayOf(health.now);
  const feedRead = day === "" ? null : { route: "/api/spine", query: { date: day, limit: FEED_LIMIT }, poll: true };
  if (feedRead !== null) reads.push(feedRead);
  const feedP = feedRead === null ? null : payloadOf(payloads, feedRead);
  const events = feedP !== null && feedP.state === "ok" ? readSpinePage(feedP.data).events : [];

  const rooms = (ctx.rooms || []).filter((r) => r.status !== "template" && r.template !== true);
  // The served order: rings in the order the registry lists their rooms, never a constant here.
  /** @type {string[]} */
  const rings = [];
  for (const r of rooms) if (!rings.includes(r.ring)) rings.push(r.ring);

  /** @type {Map<string, { today: number, last: import("../../../lib/inbox.mjs").FeedEvent | null }>} */
  const byRoom = new Map();
  for (const r of rooms) byRoom.set(r.id, { today: 0, last: null });
  for (const e of events) {
    for (const r of rooms) {
      const kinds = r.holds && Array.isArray(r.holds.kinds) ? r.holds.kinds : [];
      if (!kinds.includes(e.kind)) continue;
      const tally = byRoom.get(r.id);
      if (tally) { tally.today++; tally.last = e; }
    }
  }

  /** @param {import("../../../lib/rooms.mjs").Room} r @returns {StationState} */
  const stateOf = (r) => {
    if (r.planned === true || r.status === "planned") return "planned";
    if (r.render === "index" || (r.live && r.live.state === "index")) return "index";
    if ((byRoom.get(r.id)?.today ?? 0) > 0) return "live";
    if (r.live && r.live.receipts > 0) return "quiet";
    return "unexercised";
  };

  /** @type {Record<StationState, number>} */
  const counts = { live: 0, quiet: 0, unexercised: 0, planned: 0, index: 0 };
  const hoverId = picks.station ?? "";
  const rows = rings.map((ring, i) => {
    const list = rooms.filter((r) => r.ring === ring);
    const y = 40 + i * ROW_H;
    const gap = (W - 160) / Math.max(1, list.length - 1);
    const ink = RING_INK[ring] ?? "var(--text-2)";
    const stations = list.map((r, j) => {
      const state = stateOf(r);
      counts[state]++;
      const today = byRoom.get(r.id)?.today ?? 0;
      const live = state === "live";
      const planned = state === "planned";
      return {
        id: r.id, name: r.name, x: 80 + j * gap, y, nameY: y + 26, stateY: y + 39, countY: y + 3.5,
        r: live ? 8 : 6.5,
        fill: live ? ink : state === "index" ? "var(--bg-4)" : "var(--bg-2)",
        stroke: planned ? "var(--violet)" : ink,
        strokeWidth: live ? 0 : 1.5,
        dash: state === "unexercised" ? "4 4" : planned ? "1.5 4" : undefined,
        labelInk: hoverId === r.id ? "var(--text-1)" : planned ? "var(--violet)" : "var(--text-2)",
        stateInk: live ? ink : planned ? "var(--violet)" : "var(--text-3)",
        stateLabel: state === "quiet" ? `${fmtInt(r.live ? r.live.receipts : 0)} ever` : state,
        hasToday: today > 0,
        todayLabel: today > 99 ? "99" : String(today),
      };
    });
    const first = stations[0];
    const lastStation = stations[stations.length - 1];
    return { ring, y, labelY: y + 4, ink, x0: first ? first.x : 80, x1: lastStation ? lastStation.x : W - 80, stations };
  });

  const laneMap = ctx.laneMap && typeof ctx.laneMap === "object" ? ctx.laneMap : {};
  const lanes = Object.entries(laneMap).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([lane, roomId]) => {
    const room = rooms.find((r) => r.id === roomId);
    const state = room ? stateOf(room) : "not served";
    return {
      lane, room: roomId, name: room ? room.name : roomId,
      ink: room ? (RING_INK[room.ring] ?? "var(--text-2)") : "var(--text-3)",
      state, stateInk: state === "live" && room ? (RING_INK[room.ring] ?? "var(--text-2)") : "var(--text-3)",
      canOpen: room !== undefined,
    };
  });
  const plannedNames = rooms.filter((r) => stateOf(r) === "planned").map((r) => r.id);

  const hovered = rooms.find((r) => r.id === hoverId) ?? null;
  const hoverTally = hovered === null ? null : byRoom.get(hovered.id) ?? null;
  const hoverState = hovered === null ? null : stateOf(hovered);
  const lastEvent = hoverTally === null ? null : hoverTally.last;

  return {
    sentence: decodeDoorText(ctx.room.sentence),
    lede: decodeDoorText(ctx.room.lede),
    badge: `${fmtInt(rooms.length)} stations · ${fmtInt(lanes.length)} lanes · derived live`,
    kpis: [
      { key: "live", v: fmtInt(counts.live), l: "Live today", sub: "a receipt it homes fired today" },
      { key: "quiet", v: fmtInt(counts.quiet), l: "Quiet", sub: "fired before, not today" },
      { key: "unexercised", v: fmtInt(counts.unexercised), l: "Unexercised", sub: "never fired, drawn dashed" },
      { key: "planned", v: fmtInt(counts.planned), l: "Planned", sub: "lane not born, drawn dotted" },
      { key: "index", v: fmtInt(counts.index), l: "Index rooms", sub: "point at other rooms" },
    ],
    viewBox: `0 0 ${W} ${ROW_H * rings.length + 24}`,
    rows,
    legend: [
      { key: "live", label: `live · a receipt fired here today (${fmtInt(counts.live)})`, fill: "var(--accent)", border: "1px solid var(--accent)" },
      { key: "quiet", label: `quiet · fired before, not today (${fmtInt(counts.quiet)})`, fill: "transparent", border: "1px solid var(--text-3)" },
      { key: "unexercised", label: `unexercised · never fired (${fmtInt(counts.unexercised)})`, fill: "transparent", border: "1px dashed var(--text-3)" },
      { key: "planned", label: `planned · lane not born (${fmtInt(counts.planned)})`, fill: "transparent", border: "1px dotted var(--violet)" },
      { key: "index", label: `index · points at other rooms (${fmtInt(counts.index)})`, fill: "var(--bg-4)", border: "1px solid var(--line-2)" },
    ],
    feedNote: feedP === null ? "reading the door's day" : feedP.state === "refused" ? `${feedP.code}: ${feedP.human} -- no station is drawn live without today's receipts` : `today is ${day} on the door's clock`,
    isFeedRefused: feedP !== null && feedP.state === "refused",
    lanes,
    lanesHint: `${fmtInt(lanes.length)} born lanes → the room that renders each · face-coverage fails on a lane with no room`,
    lanesFoot: plannedNames.length === 0
      ? "Every served room has a born lane or is an index."
      : `${plannedNames.join(", ")} ${plannedNames.length === 1 ? "has" : "have"} no lane yet and stay${plannedNames.length === 1 ? "s" : ""} dotted until /arc-kickoff --lane births ${plannedNames.length === 1 ? "it" : "them"}.`,
    hovered: {
      isShown: hovered !== null,
      title: hovered === null ? "Station" : `Station · ${hovered.name}`,
      ring: hovered === null ? "" : hovered.ring,
      sentence: hovered === null ? "" : decodeDoorText(hovered.sentence),
      lede: hovered === null ? "" : decodeDoorText(hovered.lede),
      today: fmtInt(hoverTally === null ? 0 : hoverTally.today),
      ever: hovered === null || !hovered.live ? "—" : fmtInt(hovered.live.receipts),
      last: lastEvent === null ? "" : `last today: ${eventLine(lastEvent)} ⌗ ${shortId(lastEvent.id)}`,
      hasLast: lastEvent !== null,
      note: hoverState === "planned" ? "planned — no manifest is invented for an unborn lane"
        : hoverState === "index" ? "an index room — it homes no receipts of its own"
          : hoverState === "quiet" ? "fired before, nothing homed here today"
            : "never fired — this station is drawn dashed until a receipt homes here",
    },
    reads,
  };
}
