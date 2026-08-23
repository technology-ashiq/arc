// map.mjs -- the transit map of the whole company.
//
// Every ROOM is a station. Every RING is a line. Rooms sit along their ring's line in the
// contract's own order, and the marks a station wears are the truth about it: dashed if it
// was built and has never run, dotted if it is only planned, a diamond if it renders a whole
// inventory, a halo if a receipt of its lands in another room too.
//
// The room's sentence is "If it is not on this map, it is not in the company." That sentence
// is a CLAIM, and the only way a claim like that survives contact with 33 rooms is if the
// thing that makes it is checkable. So everything here is a pure function over the registry:
// no React, no DOM, no measurement, no clock. `buildMap()` takes the rooms the door served
// and returns geometry; `labelCollisions()` says whether the result is legible;
// `legendGaps()` says whether every mark drawn is a mark the legend explains; `mapSummary()`
// says how many stations were drawn and of what kind. A node test can assert all four
// against the real registry, which is the point -- CI cannot `npm install`, so a branch that
// lives in a .tsx is a branch nobody tests, and the map's correctness IS its layout maths.
//
// Colour: NONE of the reserved hues appears on this map. --amber is needs-you, --green is
// real money, --red is an incident and --violet is anything not real; where a room sits is
// not a fact about any of those, so the map spends none of them. Lines are told apart by
// WEIGHT and POSITION, states by STROKE PATTERN, room kinds by SHAPE -- four channels, none
// of them hue, so the map reads identically to a colour-blind reader. That is also why this
// file emits no colour at all: every draw op carries a `tone` name and the stylesheet
// resolves it through a token. A hex here would be a second spelling of a reserved meaning.

import { RING_ORDER, RING_LEDE } from "./rooms.mjs";

/**
 * A room as the door serves it (`GET /api/rooms`). Deliberately looser than rooms.mjs's
 * `Room`: the map must survive a registry read from disk with no `live` block at all, and
 * must draw that as "state unknown" rather than as "running".
 *
 * @typedef {object} MapRoomInput
 * @property {string} id
 * @property {string} name
 * @property {string} ring
 * @property {string} [sentence]
 * @property {string} [lede]
 * @property {string} [render]
 * @property {string} [indexes]
 * @property {boolean} [planned]
 * @property {boolean} [template]
 * @property {Record<string, string[]>} [holds]
 * @property {{ state?: string, receipts?: number, kindsHomed?: number, kindsFired?: number }} [live]
 */

/**
 * One drawable primitive. Every visible thing on this map -- a line segment, a station
 * outline, a halo, a legend swatch -- is one of these, so the renderer is a single
 * expression with no branch in it. `tone` names a token; it is never a colour.
 *
 * @typedef {object} DrawOp
 * @property {string} d
 * @property {string | null} dash
 * @property {number} width
 * @property {boolean} fill
 * @property {"line"|"station"|"dim"|"faint"} tone
 */

/**
 * @typedef {object} Transfer
 * @property {string} roomId
 * @property {string} roomName
 * @property {string} ring
 * @property {{ category: string, item: string }[]} shared
 */

/**
 * @typedef {object} MapLabel
 * @property {string} id
 * @property {string} text
 * @property {number} x        anchor x (text-anchor is always "middle")
 * @property {number} y        baseline y
 * @property {"above"|"below"|"right"} side
 * @property {"middle"|"start"} anchor
 * @property {number} boxX
 * @property {number} boxY
 * @property {number} boxW
 * @property {number} boxH
 */

/**
 * @typedef {object} MapStation
 * @property {string} id
 * @property {string} name
 * @property {string} ring
 * @property {number} lineIndex
 * @property {number} index       position along the line, 0-based
 * @property {number} ofLine      how many stations that line carries
 * @property {number} x
 * @property {number} y
 * @property {"live"|"unexercised"|"file-borne"|"index"|"planned"|"template"|"unknown"} state
 * @property {"solid"|"dashed"|"dotted"|"pending"} pattern
 * @property {"circle"|"diamond"|"square"} shape
 * @property {boolean} halo
 * @property {boolean} core
 * @property {boolean} onSpur
 * @property {number} receipts
 * @property {number} kindsHomed
 * @property {number} kindsFired
 * @property {boolean} receiptsKnown
 * @property {Transfer[]} transfers
 * @property {string} [indexes]
 * @property {string} [sentence]
 * @property {DrawOp[]} ops
 * @property {number} hitR
 * @property {MapLabel} label
 * @property {string} title      the accessible name; also the SVG <title>
 * @property {{ label: string, value: string }[]} rows   the focus read-out
 */

/**
 * @typedef {object} MapSegment
 * @property {string} from
 * @property {string} to
 * @property {"solid"|"dashed"|"dotted"|"pending"} pattern
 * @property {DrawOp} op
 */

/**
 * @typedef {object} MapLine
 * @property {string} id
 * @property {number} index
 * @property {string} name
 * @property {string} lede
 * @property {number} weight
 * @property {number} y
 * @property {MapStation[]} stations
 * @property {MapStation | null} spur
 * @property {DrawOp | null} spurOp
 * @property {MapSegment[]} segments
 * @property {{ x: number, y: number }[]} nodes   lead cap, every station, tail cap
 * @property {string} d          the whole polyline, terminus to terminus
 * @property {number} length
 * @property {boolean} hasRun
 * @property {{ x: number, y: number, name: string, lede: string, count: string }} plaque
 */

/**
 * @typedef {object} MapModel
 * @property {number} width
 * @property {number} height
 * @property {string} viewBox
 * @property {MapLine[]} lines
 * @property {MapStation[]} stations
 * @property {MapLabel[]} labels
 * @property {number} collisions
 * @property {{ token: string, label: string, real: boolean, background: string }} mode
 * @property {{ sentence: string, lede: string }} opening
 * @property {ReturnType<typeof mapSummary>} summary
 */

/**
 * Layout constants, in user units of the viewBox. Exported because the acceptance bar --
 * "legible at 33 stations across 5 lines" -- is a statement about these numbers, and a
 * number a test cannot see is a number nobody is holding.
 *
 * `colGap` is the one that carries the bar. Labels alternate above and below the line, so
 * each label owns TWO gaps of horizontal room (224u) against a longest room name of ~95u at
 * `labelSize`. That is the margin `labelCollisions()` proves rather than assumes.
 */
export const MAP_GEOMETRY = Object.freeze({
  padLeft: 256,        // the ring plaque column: name, lede and count, right-aligned
  padTop: 64,
  padRight: 36,
  padBottom: 34,
  rowGap: 124,         // between one ring's line and the next
  colGap: 112,         // between stations along a line
  branchDrop: 40,      // the 45-degree step down onto the planned branch
  capLead: 26,         // how far the line runs before its first station
  capTail: 26,         // ...and past its last
  cornerRadius: 9,
  stationR: 6.5,
  haloR: 11,
  coreR: 2.6,
  squareR: 5.5,
  diamondR: 7.6,
  hitR: 20,            // 40u tap/click target; the token floor for a live row is 44px
  labelGap: 20,
  labelSize: 10.5,
  labelAdvance: 0.6,   // JetBrains Mono advance width as a fraction of the em
  labelPad: 4,         // slack added to every label box before testing for overlap
  plaqueGap: 18,
  plaqueLedeSize: 9,
  spurRun: 34,         // the 45-degree siding the lane TEMPLATE hangs off
  dotSpeed: 90,        // user units per second, so every line's dot moves at one speed
});

/**
 * The room this module renders. Its opening sentence and lede are read out of the registry
 * rather than written here: the contract authors both, `face-coverage` holds them, and a
 * second copy in a view is how a room ends up saying something the company no longer means.
 */
export const MAP_ROOM_ID = "map";

/**
 * Line weight by ring position. The command ring is drawn heaviest because it is the daily
 * surface and everything else is one level in -- the same reason it is first in RING_ORDER.
 * Five distinct weights is one of the two channels that tell the lines apart without hue;
 * position is the other, and the plaque names them outright so neither has to carry it alone.
 * @type {readonly number[]}
 */
export const LINE_WEIGHT = Object.freeze([4, 3.2, 2.6, 2.1, 1.7]);

/**
 * @param {number} index
 * @returns {number}
 */
export function lineWeight(index) {
  const w = LINE_WEIGHT[index];
  // A sixth ring would otherwise draw at width `undefined` and vanish. A ring this shell
  // does not know about is exactly the thing the map exists to make visible, so it gets the
  // thinnest weight rather than none.
  return typeof w === "number" ? w : LINE_WEIGHT[LINE_WEIGHT.length - 1] ?? 1.7;
}

/**
 * The four stroke patterns, and nothing else. Dash values are the base at width 1.6; see
 * `dashArray` for why they scale with the line.
 * @type {Record<string, { dash: string | null, rank: number }>}
 */
export const PATTERN = Object.freeze({
  solid: { dash: null, rank: 0 },
  dashed: { dash: "7 5", rank: 1 },
  pending: { dash: "3 3", rank: 2 },
  dotted: { dash: "1.5 5", rank: 3 },
});

/** The order a pattern's weakness beats another's, weakest last. Used by `segmentPattern`. */
const PATTERN_BY_RANK = ["solid", "dashed", "pending", "dotted"];

/**
 * The one collapsed state a station wears.
 *
 * `planned` and `template` win over whatever the door computed from the log, and that
 * ordering is load-bearing rather than tidy: `ops` homes `incident.raised`, and the day an
 * incident fires anywhere the door will report that room as "live". It would not be. A room
 * that has not been built cannot be running, and drawing it as running is the dishonest
 * empty room this whole product exists not to ship.
 *
 * A room with no `live` block at all is `unknown` -- never `live`, never `unexercised`. The
 * difference between "measured and it is nothing" and "not measured" is the difference the
 * Truth Law turns on, and a registry read straight off disk has not been measured.
 *
 * @param {MapRoomInput} room
 * @returns {MapStation["state"]}
 */
export function stationState(room) {
  if (room.template === true) return "template";
  if (room.planned === true) return "planned";
  const s = room.live && typeof room.live.state === "string" ? room.live.state : null;
  if (s === "live" || s === "unexercised" || s === "file-borne" || s === "index") return s;
  return "unknown";
}

/**
 * State -> stroke pattern. Three of the six states draw solid because all three are built
 * and all three run; what separates them is the station's SHAPE and its receipt count, not
 * its stroke. Reusing one pattern for three states is deliberate -- a reader should not have
 * to learn six line styles to read five lines.
 * @param {MapStation["state"]} state
 * @returns {MapStation["pattern"]}
 */
export function patternFor(state) {
  switch (state) {
    case "unexercised": return "dashed";
    case "planned": return "dotted";
    case "unknown": return "pending";
    default: return "solid"; // live · file-borne · index · template
  }
}

/**
 * The pattern of the track BETWEEN two stations: the weaker end wins.
 *
 * A segment is only as exercised as its weaker end, so a run of track into a planned room is
 * dotted for its whole length and a line whose every station is unexercised is dashed from
 * terminus to terminus -- which is the brief's "unexercised LINES drawn dashed", falling out
 * of the station rule rather than being asserted separately.
 *
 * @param {MapStation["state"]} a @param {MapStation["state"]} b
 * @returns {MapStation["pattern"]}
 */
export function segmentPattern(a, b) {
  const pa = PATTERN[patternFor(a)];
  const pb = PATTERN[patternFor(b)];
  const rank = Math.max(pa ? pa.rank : 0, pb ? pb.rank : 0);
  const name = PATTERN_BY_RANK[rank];
  return name === "dashed" || name === "dotted" || name === "pending" ? name : "solid";
}

/**
 * The dash array for a pattern at a given stroke width.
 *
 * Dashes must grow with the line or the command ring's 4u track reads as a row of squares
 * while the company ring's 1.7u track reads as a proper dotted line -- two lines that are
 * meant to say the same thing saying it differently. The scale is deliberately sub-linear
 * (0.6 + 0.4 * w/1.6) so a heavy line's dashes lengthen without becoming stripes.
 *
 * @param {string} pattern @param {number} width
 * @returns {string | null}
 */
export function dashArray(pattern, width) {
  const p = PATTERN[pattern];
  if (!p || p.dash === null) return null;
  const factor = 0.6 + 0.4 * (width / 1.6);
  return p.dash
    .split(" ")
    .map((n) => String(Math.round(Number(n) * factor * 100) / 100))
    .join(" ");
}

/**
 * The dash a STATION outline wears, which is not the dash its track wears.
 *
 * A station's circumference is about 41u. The track's 7/5 dash laid around it yields three
 * and a half dashes and reads as a broken ring rather than a dashed one -- and stacked
 * inside an interchange halo it read, on the first render, as a smudge. Rendering it proved
 * that in a way the collision count could not: the geometry was correct and the picture was
 * unreadable. So the glyph gets its own, finer scale, tuned to the arc it has to travel.
 * @param {MapStation["pattern"]} pattern
 * @returns {string | null}
 */
export function stationDash(pattern) {
  switch (pattern) {
    case "dashed": return "3.2 2.6";
    case "dotted": return "0.9 3.2";
    case "pending": return "2 2.4";
    default: return null;
  }
}

/**
 * The glyph a room wears, in three orthogonal channels and no colour:
 *   shape  what the room IS      circle = a room · diamond = an index · square = a template
 *   halo   what it CONNECTS to   an outer ring when a receipt of its lands in another room
 *   core   what has HAPPENED     a filled centre when one of its kinds has actually fired
 *
 * `core` is strictly "receipts > 0", which leaves index and file-borne rooms hollow. That
 * looks like a bug and is not: those rooms home no event kinds at all, so the log has
 * nothing to say about them, and a filled centre would claim a receipt that does not exist.
 * The legend carries the sentence that makes a hollow solid station readable.
 *
 * @param {MapRoomInput} room @param {number} [transfers] how many other rooms share a row with it
 * @returns {{ state: MapStation["state"], pattern: MapStation["pattern"], shape: MapStation["shape"], halo: boolean, core: boolean, r: number }}
 */
export function glyphFor(room, transfers = 0) {
  const state = stationState(room);
  const shape = room.template === true
    ? "square"
    : (state === "index" || room.render === "index")
      ? "diamond"
      : "circle";
  // The template's core follows its receipts like every other station's. `kickoff.done` and
  // `phase.closed` are homed HERE and nowhere else, so blanking the count to make the glyph
  // tidier would delete two real kinds from the map's total -- the map would then under-report
  // the company to make a point about the company. The attribution is fixed in words instead,
  // in `stationRows`, where it can say the receipts fired in the lanes built from this shape.
  const receipts = Number(room.live && room.live.receipts) || 0;
  const r = shape === "square" ? MAP_GEOMETRY.squareR : shape === "diamond" ? MAP_GEOMETRY.diamondR : MAP_GEOMETRY.stationR;
  return { state, pattern: patternFor(state), shape, halo: transfers > 0, core: receipts > 0, r };
}

/**
 * Which rooms share an inventory row with which other rooms.
 *
 * An interchange on this map means what an interchange means on a transit map: one thing
 * arrives at two places. Two rooms that both home `incident.raised` both light up on the
 * same receipt, so a person reading Today and a person reading Policy are looking at the
 * same event from two platforms.
 *
 * It walks EVERY category in `holds`, not just `kinds`, although today only `kinds` overlaps
 * (20 of 44 kinds are homed in more than one room; concepts, products, lanes, commands,
 * agents, processes, gates, hooks, rules and lints are each homed exactly once by contract).
 * Hard-coding "kinds" would have been correct today and silently wrong the first time the
 * contract homes one lane in two rooms -- and a map that quietly stops showing a connection
 * is worse than one that never showed it.
 *
 * @param {MapRoomInput[]} rooms
 * @returns {Map<string, Transfer[]>}
 */
export function transferIndex(rooms) {
  // Nested maps rather than a joined "category<sep>item" string key. The first cut joined
  // them and had to pick a separator no item could contain -- room inventories carry items
  // like "Why? precedents" and "arc ring", so a space was not safe and the separator that
  // WAS safe put a raw control byte in the source, which is how a text file starts being
  // treated as binary by every tool that touches it. A key that needs an unprintable
  // character is a key that wanted to be two keys.
  /** @type {Map<string, Map<string, string[]>>} category -> item -> the rooms that home it */
  const homes = new Map();
  for (const room of rooms) {
    const holds = room.holds;
    if (!holds) continue;
    for (const category of Object.keys(holds)) {
      const items = holds[category];
      if (!Array.isArray(items)) continue;
      let byItem = homes.get(category);
      if (!byItem) { byItem = new Map(); homes.set(category, byItem); }
      for (const item of items) {
        let ids = byItem.get(item);
        if (!ids) { ids = []; byItem.set(item, ids); }
        ids.push(room.id);
      }
    }
  }

  const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
  const ringOf = new Map(rooms.map((r) => [r.id, r.ring]));
  /** @type {Map<string, Map<string, Transfer>>} */
  const out = new Map();
  for (const room of rooms) out.set(room.id, new Map());

  for (const [category, byItem] of homes) {
    for (const [item, ids] of byItem) {
      if (ids.length < 2) continue;
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) continue;
          const mine = out.get(a);
          if (!mine) continue;
          let t = mine.get(b);
          if (!t) {
            t = { roomId: b, roomName: nameOf.get(b) ?? b, ring: ringOf.get(b) ?? "", shared: [] };
            mine.set(b, t);
          }
          t.shared.push({ category, item });
        }
      }
    }
  }

  /** @type {Map<string, Transfer[]>} */
  const result = new Map();
  for (const [id, m] of out) {
    const list = [...m.values()];
    list.sort((x, y) => (y.shared.length - x.shared.length) || x.roomId.localeCompare(y.roomId));
    for (const t of list) t.shared.sort((x, y) => x.item.localeCompare(y.item));
    result.set(id, list);
  }
  return result;
}

// ---------------------------------------------------------------------------------------
// text, without a DOM
// ---------------------------------------------------------------------------------------

/**
 * Width of a run of mono text, in user units. There is no DOM here and there must not be:
 * a layout that can only be checked in a browser is a layout CI cannot hold. JetBrains Mono
 * advances 0.6em per glyph, which is exact for the mono face and a slight over-estimate for
 * the display face -- over-estimating is the safe direction, because it makes label boxes
 * larger and collisions MORE likely to be reported, never less.
 * @param {string} text @param {number} [fontSize] @param {number} [advance]
 */
export function estimateTextWidth(text, fontSize = MAP_GEOMETRY.labelSize, advance = MAP_GEOMETRY.labelAdvance) {
  return String(text ?? "").length * fontSize * advance;
}

/**
 * Truncate to fit a width, with a real ellipsis. Used for the ring plaque, which is the one
 * place on this map where the text is not under the contract's control.
 * @param {string} text @param {number} maxWidth @param {number} [fontSize] @param {number} [advance]
 */
export function fitText(text, maxWidth, fontSize = MAP_GEOMETRY.labelSize, advance = MAP_GEOMETRY.labelAdvance) {
  const s = String(text ?? "");
  const per = fontSize * advance;
  if (per <= 0) return s;
  const max = Math.floor(maxWidth / per);
  if (s.length <= max) return s;
  if (max <= 1) return "…";
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------------------

/**
 * A closed path for a station glyph. Every shape -- circle included -- comes back as a `d`
 * string so the renderer draws `<path d={op.d} />` for all three and carries no branch of
 * its own. A three-way switch inside a .tsx is three branches nobody tests.
 * @param {MapStation["shape"]} shape @param {number} x @param {number} y @param {number} r
 * @returns {string}
 */
export function stationPath(shape, x, y, r) {
  /** @param {number} v */
  const n = (v) => Math.round(v * 100) / 100;
  if (shape === "diamond") return `M ${n(x)} ${n(y - r)} L ${n(x + r)} ${n(y)} L ${n(x)} ${n(y + r)} L ${n(x - r)} ${n(y)} Z`;
  if (shape === "square") return `M ${n(x - r)} ${n(y - r)} L ${n(x + r)} ${n(y - r)} L ${n(x + r)} ${n(y + r)} L ${n(x - r)} ${n(y + r)} Z`;
  return `M ${n(x - r)} ${n(y)} a ${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0 Z`;
}

/**
 * The path between two nodes, with a 45-degree dogleg when the y changes.
 *
 * The dogleg is centred in the gap and its corners are filleted with a quadratic whose
 * control point sits on the corner vertex -- which is exactly tangent to both legs, so the
 * turn is smooth without any trigonometry. When the gap is too short to hold a 45-degree
 * run, or too short to hold the fillets, it degrades to a straight line rather than drawing
 * a corner that overshoots the next station.
 *
 * @param {{ x: number, y: number }} a @param {{ x: number, y: number }} b @param {number} [radius]
 * @returns {string} an SVG path starting with M
 */
export function segmentPath(a, b, radius = MAP_GEOMETRY.cornerRadius) {
  /** @param {number} v */
  const n = (v) => Math.round(v * 100) / 100;
  const dy = b.y - a.y;
  const gap = b.x - a.x;
  if (dy === 0 || Math.abs(gap) <= Math.abs(dy)) return `M ${n(a.x)} ${n(a.y)} L ${n(b.x)} ${n(b.y)}`;

  const run = Math.abs(dy);
  const sign = dy > 0 ? 1 : -1;
  const startX = a.x + (gap - run) / 2;
  const endX = startX + run;
  const k = Math.SQRT1_2;
  // A fillet cannot eat more than half of either leg, or the two corners meet and the path
  // folds back on itself.
  const r = Math.max(0, Math.min(radius, (startX - a.x) * 0.9, (b.x - endX) * 0.9, run * 0.45));
  if (r <= 0.5) {
    return `M ${n(a.x)} ${n(a.y)} L ${n(startX)} ${n(a.y)} L ${n(endX)} ${n(b.y)} L ${n(b.x)} ${n(b.y)}`;
  }
  return [
    `M ${n(a.x)} ${n(a.y)}`,
    `L ${n(startX - r)} ${n(a.y)}`,
    `Q ${n(startX)} ${n(a.y)} ${n(startX + r * k)} ${n(a.y + r * k * sign)}`,
    `L ${n(endX - r * k)} ${n(b.y - r * k * sign)}`,
    `Q ${n(endX)} ${n(b.y)} ${n(endX + r)} ${n(b.y)}`,
    `L ${n(b.x)} ${n(b.y)}`,
  ].join(" ");
}

/**
 * The whole polyline through a list of nodes, as one `d`. Used for the flight dot's motion
 * path -- a dot has to travel the line, not one of its segments.
 * @param {{ x: number, y: number }[]} nodes @param {number} [radius]
 * @returns {string}
 */
export function linePath(nodes, radius = MAP_GEOMETRY.cornerRadius) {
  if (!nodes.length) return "";
  const first = nodes[0];
  if (!first) return "";
  let d = `M ${Math.round(first.x * 100) / 100} ${Math.round(first.y * 100) / 100}`;
  for (let i = 1; i < nodes.length; i += 1) {
    const a = nodes[i - 1];
    const b = nodes[i];
    if (!a || !b) continue;
    d += ` ${segmentPath(a, b, radius).replace(/^M [^ ]+ [^ ]+ /, "")}`;
  }
  return d;
}

/**
 * The length of that polyline, close enough to set an animation duration. The dogleg
 * contributes (gap - run) straight plus run * sqrt(2) diagonal; the fillets shave a couple
 * of units off and are ignored, which is a rounding error on a ten-second traverse.
 * @param {{ x: number, y: number }[]} nodes
 * @returns {number}
 */
export function pathLength(nodes) {
  let total = 0;
  for (let i = 1; i < nodes.length; i += 1) {
    const a = nodes[i - 1];
    const b = nodes[i];
    if (!a || !b) continue;
    const gap = Math.abs(b.x - a.x);
    const run = Math.abs(b.y - a.y);
    total += run === 0 ? gap : (gap <= run ? Math.hypot(gap, run) : (gap - run) + run * Math.SQRT2);
  }
  return Math.round(total * 100) / 100;
}

/**
 * The 45-degree siding a template hangs off. It leaves the line UP and to the right, which
 * is the one direction on this map that never carries track: the planned branch always steps
 * down, so up cannot be mistaken for a route.
 * @param {number} x @param {number} y @param {number} [run]
 * @returns {{ d: string, x: number, y: number }}
 */
export function spurPath(x, y, run = MAP_GEOMETRY.spurRun) {
  const ex = x + run;
  const ey = y - run;
  return { d: `M ${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100} L ${Math.round(ex * 100) / 100} ${Math.round(ey * 100) / 100}`, x: ex, y: ey };
}

// ---------------------------------------------------------------------------------------
// labels
// ---------------------------------------------------------------------------------------

/**
 * The box a label occupies, padded. Text boxes are grown by `labelPad` on every side before
 * anything is compared, so two labels that merely touch are already a collision -- the
 * conservative direction, again.
 * @param {number} centreX @param {number} baselineY @param {number} width @param {number} size @param {"middle"|"start"} [anchor]
 */
/**
 * @param {number} centreX @param {number} baselineY @param {number} width @param {number} size
 * @param {"middle"|"start"} [anchor]
 */
function boxFor(centreX, baselineY, width, size, anchor = "middle") {
  const pad = MAP_GEOMETRY.labelPad;
  const left = anchor === "start" ? centreX : centreX - width / 2;
  return {
    boxX: left - pad,
    boxY: baselineY - size * 0.78 - pad,
    boxW: width + pad * 2,
    boxH: size + pad * 2,
  };
}

/** @param {MapLabel} a @param {MapLabel} b */
function overlaps(a, b) {
  return a.boxX < b.boxX + b.boxW && b.boxX < a.boxX + a.boxW && a.boxY < b.boxY + b.boxH && b.boxY < a.boxY + a.boxH;
}

/**
 * Every pair of labels whose boxes intersect. This is the acceptance bar as a function: the
 * map is legible at 33 stations if and only if this returns nothing, and a node test can say
 * so out loud instead of a person squinting at a screenshot.
 * @param {MapLabel[]} labels
 * @returns {{ a: string, b: string }[]}
 */
export function labelCollisions(labels) {
  /** @type {{ a: string, b: string }[]} */
  const hits = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i];
      const b = labels[j];
      if (!a || !b) continue;
      if (overlaps(a, b)) hits.push({ a: a.id, b: b.id });
    }
  }
  return hits;
}

/**
 * Place labels and then prove they do not touch.
 *
 * Placement alternates above and below the line, which doubles the room each label has and
 * is why the real registry comes out of here with zero collisions on the first pass. The
 * repair loop after it is insurance for a registry that grows: FLIP the offender to the
 * other side first (it keeps the label attached to its own station), and only if the flip is
 * no better, NUDGE it along x in small steps. Both moves are deterministic, so the same
 * registry always produces the same map -- a layout that shuffles between runs cannot be
 * diffed, and a map nobody can diff is a map nobody can trust.
 *
 * Anything still overlapping after the repair is REPORTED, never hidden. A label quietly
 * dropped to make the picture tidy is a room quietly removed from the company.
 *
 * @param {{ id: string, text: string, x: number, y: number, side: "above"|"below"|"right", pinned?: boolean }[]} wanted
 * @returns {{ labels: MapLabel[], collisions: number, moved: string[] }}
 */
export function resolveLabels(wanted) {
  const size = MAP_GEOMETRY.labelSize;
  const gap = MAP_GEOMETRY.labelGap;

  /** @param {{ id: string, text: string, x: number, y: number, side: "above"|"below"|"right" }} w @param {"above"|"below"|"right"} side @param {number} shiftX */
  const make = (w, side, shiftX) => {
    const width = estimateTextWidth(w.text, size);
    const anchor = side === "right" ? "start" : "middle";
    const x = side === "right" ? w.x + MAP_GEOMETRY.stationR + 8 + shiftX : w.x + shiftX;
    const y = side === "above" ? w.y - gap : side === "below" ? w.y + gap + size * 0.78 : w.y + size * 0.34;
    /** @type {MapLabel} */
    const label = { id: w.id, text: w.text, x, y, side, anchor, ...boxFor(x, y, width, size, anchor) };
    return label;
  };

  /** @type {MapLabel[]} */
  const placed = [];
  /** @type {string[]} */
  const moved = [];

  const order = [...wanted].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const w of order) {
    let label = make(w, w.side, 0);
    if (!placed.some((p) => overlaps(p, label))) { placed.push(label); continue; }

    let best = label;
    let bestHits = placed.filter((p) => overlaps(p, label)).length;

    if (w.pinned !== true && w.side !== "right") {
      const flipped = make(w, w.side === "above" ? "below" : "above", 0);
      const flippedHits = placed.filter((p) => overlaps(p, flipped)).length;
      if (flippedHits < bestHits) { best = flipped; bestHits = flippedHits; }
    }

    // Six steps of 8u each way, so a label can never travel further than 48u -- under half a
    // column gap. A label that walked further than that would sit closer to its neighbour's
    // station than to its own, which is not a repair, it is a relabelled station.
    for (let step = 1; step <= 6 && bestHits > 0; step += 1) {
      for (const dir of [1, -1]) {
        const candidate = make(w, best.side, dir * step * 8);
        const hits = placed.filter((p) => overlaps(p, candidate)).length;
        if (hits < bestHits) { best = candidate; bestHits = hits; }
        if (bestHits === 0) break;
      }
    }

    if (best !== label) moved.push(w.id);
    placed.push(best);
  }

  const byId = new Map(placed.map((p) => [p.id, p]));
  /** @type {MapLabel[]} */
  const labels = [];
  for (const w of wanted) {
    const p = byId.get(w.id);
    if (p) labels.push(p);
  }
  return { labels, collisions: labelCollisions(labels).length, moved };
}

// ---------------------------------------------------------------------------------------
// grouping
// ---------------------------------------------------------------------------------------

/**
 * Rooms grouped into lines, in RING_ORDER, with three orderings that are decisions:
 *
 *   1. Built rooms keep the CONTRACT'S order, which is the owner's priority order.
 *   2. Planned rooms sink to the end of their line, so a dotted station never sits above a
 *      live one -- the same rule rooms.byRing applies to the nav, for the same reason.
 *   3. The lane TEMPLATE comes off the line onto a spur.
 *
 * The template is on this map at all because of the room's own sentence. rooms.byRing drops
 * it from the nav, correctly -- it is a shape every lane instantiates, not a room you can
 * open -- but "if it is not on this map, it is not in the company" does not have an
 * exception clause, and a shape 16 lanes are built from is unambiguously in the company. So
 * it is drawn, on a siding, with a mark of its own and a legend row that says what it is.
 * That is what makes the count 33 rather than 32.
 *
 * A room whose ring is not one of the five is not dropped either: it gets its own line,
 * named for what it is. A registry that grew a ring nobody taught this shell about is
 * exactly the kind of missing thing the map exists to surface.
 *
 * @param {MapRoomInput[]} rooms
 * @returns {{ id: string, lede: string, main: MapRoomInput[], planned: MapRoomInput[], template: MapRoomInput | null }[]}
 */
export function groupIntoLines(rooms) {
  const list = Array.isArray(rooms) ? rooms : [];
  /** @type {{ id: string, lede: string, main: MapRoomInput[], planned: MapRoomInput[], template: MapRoomInput | null }[]} */
  const out = [];
  const known = new Set(RING_ORDER);

  /** @param {string} ring @param {string} lede @param {MapRoomInput[]} inRing */
  const push = (ring, lede, inRing) => {
    if (!inRing.length) return;
    /** @type {MapRoomInput[]} */ const main = [];
    /** @type {MapRoomInput[]} */ const planned = [];
    /** @type {MapRoomInput | null} */ let template = null;
    for (const r of inRing) {
      if (r.template === true) { if (template === null) template = r; else main.push(r); continue; }
      if (r.planned === true) planned.push(r); else main.push(r);
    }
    out.push({ id: ring, lede, main, planned, template });
  };

  for (const ring of RING_ORDER) {
    push(ring, RING_LEDE[ring] ?? "", list.filter((r) => r.ring === ring));
  }
  const orphans = list.filter((r) => !known.has(r.ring));
  push("unplaced", "rooms in a ring this shell does not know", orphans);
  return out;
}

// ---------------------------------------------------------------------------------------
// the model
// ---------------------------------------------------------------------------------------

/**
 * The sentence a station reads out to a screen reader, and the same sentence a sighted
 * reader gets on hover. One string, both audiences -- a tooltip that says more than the
 * accessible name is a surface only some people can read.
 * @param {MapStation} s
 * @returns {string}
 */
export function accessibleName(s) {
  const where = s.onSpur
    ? `on a siding off the ${s.ring} line`
    : `${s.ring} line, stop ${s.index + 1} of ${s.ofLine}`;
  const parts = [`${s.name} — ${where}`];
  switch (s.state) {
    case "live":
      parts.push(`running: ${s.receipts} receipt${s.receipts === 1 ? "" : "s"} across ${s.kindsFired} of ${s.kindsHomed} event kinds`);
      break;
    case "unexercised":
      parts.push(`unexercised: built, and not one of its ${s.kindsHomed} event kinds has ever fired — that is not a zero, it is no count at all`);
      break;
    case "file-borne":
      parts.push("file, not log: this room reads the tree and the contract, so the spine has no receipt count for it");
      break;
    case "index":
      parts.push(`index: renders every ${s.indexes ?? "entry"} in the company, not a slice of them`);
      break;
    case "planned":
      parts.push(s.receipts > 0
        ? `planned: not built yet. The ${s.kindsHomed} kind${s.kindsHomed === 1 ? "" : "s"} it will home ${s.kindsHomed === 1 ? "has" : "have"} fired ${s.receipts} time${s.receipts === 1 ? "" : "s"} in other rooms`
        : "planned: not built yet");
      break;
    case "template":
      parts.push(s.receipts > 0
        ? `template: a shape every lane instantiates, not a room you can open — its ${s.receipts} receipt${s.receipts === 1 ? "" : "s"} fired in the lanes built from it`
        : "template: a shape every lane instantiates, not a room you can open");
      break;
    default:
      parts.push("state unknown: the door has not answered for this room");
  }
  if (s.transfers.length) {
    const names = s.transfers.slice(0, 4).map((t) => t.roomName);
    const more = s.transfers.length - names.length;
    parts.push(`interchange with ${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}`);
  }
  return `${parts.join(". ")}.`;
}

/**
 * The read-out a station fills when it is focused or hovered. Rows rather than a paragraph,
 * because the receipt count is the thing a person came for and it should be findable by
 * position, not by reading.
 * @param {MapStation} s
 * @returns {{ label: string, value: string }[]}
 */
export function stationRows(s) {
  /** @type {{ label: string, value: string }[]} */
  const rows = [];
  rows.push({ label: "ring", value: s.ring });
  rows.push({ label: "state", value: s.state });
  rows.push({
    label: "receipts",
    value: !s.receiptsKnown
      ? "not measured"
      : s.kindsHomed === 0
        ? "no kinds homed — nothing in the log to count"
        : s.state === "template"
          ? `${s.receipts} across ${s.kindsFired}/${s.kindsHomed} kinds — fired in the lanes built from this shape, not in it`
          : `${s.receipts} across ${s.kindsFired}/${s.kindsHomed} kinds`,
  });
  if (s.transfers.length) {
    rows.push({ label: "interchange", value: s.transfers.map((t) => t.roomName).join(", ") });
    const shared = new Set();
    for (const t of s.transfers) for (const item of t.shared) shared.add(item.item);
    rows.push({ label: "shared", value: [...shared].sort().join(" · ") });
  }
  if (s.sentence) rows.push({ label: "opens with", value: s.sentence });
  return rows;
}

/**
 * Build the whole map.
 *
 * @param {MapRoomInput[]} rooms  the registry as `GET /api/rooms` serves it
 * @param {{ mode?: string, self?: MapRoomInput | null }} [opts]
 * @returns {MapModel}
 */
export function buildMap(rooms, opts = {}) {
  const G = MAP_GEOMETRY;
  const list = Array.isArray(rooms) ? rooms : [];
  const transfersOf = transferIndex(list);
  const groups = groupIntoLines(list);

  /** @type {MapLine[]} */
  const lines = [];
  /** @type {MapStation[]} */
  const stations = [];
  /** @type {{ id: string, text: string, x: number, y: number, side: "above"|"below"|"right", pinned?: boolean }[]} */
  const wantedLabels = [];

  groups.forEach((group, lineIndex) => {
    const y = G.padTop + lineIndex * G.rowGap;
    const weight = lineWeight(lineIndex);
    const ordered = [...group.main, ...group.planned];
    const spurHostIndex = group.template ? ordered.length - 1 : -1;

    /** @type {MapStation[]} */
    const lineStations = [];
    ordered.forEach((room, i) => {
      const onBranch = room.planned === true;
      const sx = G.padLeft + i * G.colGap;
      const sy = y + (onBranch ? G.branchDrop : 0);
      const transfers = transfersOf.get(room.id) ?? [];
      const glyph = glyphFor(room, transfers.length);
      const live = room.live;
      /** @type {MapStation} */
      const station = {
        id: room.id,
        name: room.name,
        ring: group.id,
        lineIndex,
        index: i,
        ofLine: ordered.length,
        x: sx,
        y: sy,
        state: glyph.state,
        pattern: glyph.pattern,
        shape: glyph.shape,
        halo: glyph.halo,
        core: glyph.core,
        onSpur: false,
        receipts: Number(live && live.receipts) || 0,
        kindsHomed: Number(live && live.kindsHomed) || 0,
        kindsFired: Number(live && live.kindsFired) || 0,
        receiptsKnown: Boolean(live && typeof live.receipts === "number"),
        transfers,
        ...(room.indexes ? { indexes: room.indexes } : {}),
        ...(room.sentence ? { sentence: room.sentence } : {}),
        ops: stationOps(sx, sy, glyph, weight),
        hitR: G.hitR,
        label: /** @type {MapLabel} */ ({ id: room.id, text: room.name, x: sx, y: sy, side: "above", anchor: "middle", boxX: 0, boxY: 0, boxW: 0, boxH: 0 }),
        title: "",
        rows: [],
      };
      station.title = accessibleName(station);
      station.rows = stationRows(station);
      lineStations.push(station);
      stations.push(station);

      // Alternate above/below so every label owns two station gaps of room -- except the one
      // station carrying a spur, which is forced below because the siding leaves upward and
      // would otherwise be drawn straight through its own label.
      const side = i === spurHostIndex ? "below" : (i % 2 === 0 ? "above" : "below");
      wantedLabels.push({ id: room.id, text: room.name, x: sx, y: sy, side, pinned: i === spurHostIndex });
    });

    // ---- the track ----
    const first = lineStations[0];
    const last = lineStations[lineStations.length - 1];
    /** @type {{ x: number, y: number }[]} */
    const nodes = [];
    if (first) nodes.push({ x: first.x - G.capLead, y: first.y });
    for (const s of lineStations) nodes.push({ x: s.x, y: s.y });
    if (last) nodes.push({ x: last.x + G.capTail, y: last.y });

    /** @type {MapSegment[]} */
    const segments = [];
    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1];
      const b = nodes[i];
      if (!a || !b) continue;
      // The lead and tail caps belong to the terminus they touch, so a line into an
      // unexercised terminus is dashed all the way to its end rather than stopping short.
      const fromStation = lineStations[i - 2];
      const toStation = lineStations[i - 1];
      const stateA = fromStation ? fromStation.state : (toStation ? toStation.state : "unknown");
      const stateB = toStation ? toStation.state : (fromStation ? fromStation.state : "unknown");
      const pattern = segmentPattern(stateA, stateB);
      segments.push({
        from: fromStation ? fromStation.id : `${group.id}:lead`,
        to: toStation ? toStation.id : `${group.id}:tail`,
        pattern,
        op: {
          d: segmentPath(a, b),
          dash: dashArray(pattern, weight),
          width: weight,
          fill: false,
          tone: pattern === "pending" ? "faint" : "line",
        },
      });
    }

    // ---- the spur, and the template that hangs off it ----
    /** @type {MapStation | null} */
    let spur = null;
    /** @type {DrawOp | null} */
    let spurOp = null;
    const host = spurHostIndex >= 0 ? lineStations[spurHostIndex] : undefined;
    const templateRoom = group.template;
    if (templateRoom && host) {
      const stub = spurPath(host.x, host.y);
      const transfers = transfersOf.get(templateRoom.id) ?? [];
      const glyph = glyphFor(templateRoom, transfers.length);
      spurOp = { d: stub.d, dash: dashArray(glyph.pattern, Math.max(1.4, weight * 0.6)), width: Math.max(1.4, weight * 0.6), fill: false, tone: "line" };
      /** @type {MapStation} */
      const s = {
        id: templateRoom.id,
        name: templateRoom.name,
        ring: group.id,
        lineIndex,
        index: ordered.length,
        ofLine: ordered.length,
        x: stub.x,
        y: stub.y,
        state: glyph.state,
        pattern: glyph.pattern,
        shape: glyph.shape,
        halo: glyph.halo,
        core: glyph.core,
        onSpur: true,
        receipts: Number(templateRoom.live && templateRoom.live.receipts) || 0,
        kindsHomed: Number(templateRoom.live && templateRoom.live.kindsHomed) || 0,
        kindsFired: Number(templateRoom.live && templateRoom.live.kindsFired) || 0,
        receiptsKnown: Boolean(templateRoom.live && typeof templateRoom.live.receipts === "number"),
        transfers,
        ...(templateRoom.indexes ? { indexes: templateRoom.indexes } : {}),
        ...(templateRoom.sentence ? { sentence: templateRoom.sentence } : {}),
        ops: stationOps(stub.x, stub.y, glyph, weight),
        hitR: G.hitR,
        label: /** @type {MapLabel} */ ({ id: templateRoom.id, text: templateRoom.name, x: stub.x, y: stub.y, side: "right", anchor: "start", boxX: 0, boxY: 0, boxW: 0, boxH: 0 }),
        title: "",
        rows: [],
      };
      s.title = accessibleName(s);
      s.rows = stationRows(s);
      spur = s;
      stations.push(s);
      wantedLabels.push({ id: s.id, text: s.name, x: s.x, y: s.y, side: "right", pinned: true });
    }

    const plaqueX = G.padLeft - G.capLead - G.plaqueGap;
    const count = ordered.length + (spur ? 1 : 0);
    lines.push({
      id: group.id,
      index: lineIndex,
      name: group.id.toUpperCase(),
      lede: group.lede,
      weight,
      y,
      stations: lineStations,
      spur,
      spurOp,
      segments,
      nodes,
      d: linePath(nodes),
      length: pathLength(nodes),
      hasRun: lineStations.some((s) => s.state === "live"),
      plaque: {
        x: plaqueX,
        y,
        name: group.id.toUpperCase(),
        lede: fitText(group.lede, plaqueX - 6, G.plaqueLedeSize),
        count: `${count} room${count === 1 ? "" : "s"}`,
      },
    });
  });

  const resolved = resolveLabels(wantedLabels);
  const byId = new Map(resolved.labels.map((l) => [l.id, l]));
  for (const s of stations) {
    const l = byId.get(s.id);
    if (l) s.label = l;
  }

  // The canvas is measured from what is actually on it, including every label box, so
  // nothing can be clipped by a constant that drifted away from the content.
  let maxX = 0;
  let maxY = 0;
  for (const line of lines) {
    const last = line.stations[line.stations.length - 1];
    if (last) { maxX = Math.max(maxX, last.x + G.capTail); maxY = Math.max(maxY, last.y); }
    for (const s of line.stations) maxY = Math.max(maxY, s.y + G.haloR);
    if (line.spur) { maxX = Math.max(maxX, line.spur.x + G.haloR); maxY = Math.max(maxY, line.spur.y + G.haloR); }
  }
  for (const l of resolved.labels) {
    maxX = Math.max(maxX, l.boxX + l.boxW);
    maxY = Math.max(maxY, l.boxY + l.boxH);
  }
  const width = Math.round(maxX + G.padRight);
  const height = Math.round(maxY + G.padBottom);

  const model = /** @type {MapModel} */ ({
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    lines,
    stations,
    labels: resolved.labels,
    collisions: resolved.collisions,
    mode: modeChip(opts.mode),
    opening: openingOf(list, opts.self ?? null),
    summary: { stations: 0, lines: 0, live: 0, unexercised: 0, fileBorne: 0, index: 0, planned: 0, template: 0, unknown: 0, interchanges: 0, receipts: 0, sentence: "" },
  });
  model.summary = mapSummary(model);
  return model;
}

/**
 * The draw ops for one station: outline, then halo, then core. Split out so the station and
 * the legend build their glyphs with the same function -- a legend drawn by different code
 * from the thing it explains is a legend that can go quietly out of date.
 * @param {number} x @param {number} y
 * @param {{ pattern: MapStation["pattern"], shape: MapStation["shape"], halo: boolean, core: boolean, r: number, state: MapStation["state"] }} glyph
 * @param {number} lineWidthHint
 * @returns {DrawOp[]}
 */
export function stationOps(x, y, glyph, lineWidthHint = 2) {
  const G = MAP_GEOMETRY;
  const stroke = Math.max(1.4, Math.min(2.2, lineWidthHint * 0.62));
  /** @type {DrawOp[]} */
  const ops = [];
  if (glyph.halo) {
    // The halo is ALWAYS solid. It says what a room connects to, which is a fact about the
    // contract and not about whether anything has run yet -- dashing it would have the mark
    // change meaning with the state it is meant to be independent of.
    ops.push({ d: stationPath(glyph.shape, x, y, glyph.r + 4.5), dash: null, width: 1.1, fill: false, tone: "dim" });
  }
  ops.push({
    d: stationPath(glyph.shape, x, y, glyph.r),
    dash: stationDash(glyph.pattern),
    width: stroke,
    fill: false,
    tone: glyph.state === "unknown" ? "faint" : "station",
  });
  if (glyph.core) {
    ops.push({ d: stationPath("circle", x, y, G.coreR), dash: null, width: 0, fill: true, tone: "station" });
  }
  return ops;
}

/**
 * The dots that travel the lines.
 *
 * One dot per line, and only on a line that has actually recorded something: a dot on a
 * dashed line would animate traffic through rooms that have never run, which is the moving
 * version of the lie the dashed stroke exists to prevent. Every dot moves at the same speed,
 * so a long line takes longer to traverse than a short one -- distance reads as distance.
 *
 * The caller must not render these when the reader has asked for reduced motion. That check
 * is a browser API and lives in the view; WHICH dots exist and how fast they go is a
 * decision and lives here.
 *
 * @param {MapModel} model @param {{ speed?: number }} [opts]
 * @returns {{ lineId: string, d: string, dur: string, begin: string, r: number }[]}
 */
export function flightDots(model, opts = {}) {
  const speed = opts.speed ?? MAP_GEOMETRY.dotSpeed;
  /** @type {{ lineId: string, d: string, dur: string, begin: string, r: number }[]} */
  const dots = [];
  model.lines.forEach((line, i) => {
    // The dot travels the longest UNBROKEN SOLID run on the line, not the line. The first
    // render of this map ran a dot end to end and animated traffic straight through Develop,
    // a room that has never once run -- a moving version of the exact claim the dashed
    // stroke beside it was denying. A dot may only cross track that has carried something.
    let bestStart = -1;
    let bestEnd = -1;
    let start = -1;
    for (let k = 0; k <= line.segments.length; k += 1) {
      const seg = line.segments[k];
      const solid = seg ? seg.pattern === "solid" : false;
      if (solid && start === -1) start = k;
      if (!solid && start !== -1) {
        if (k - start > bestEnd - bestStart) { bestStart = start; bestEnd = k; }
        start = -1;
      }
    }
    if (bestStart === -1) return;

    // ...and only if a room on that run has actually recorded a receipt. Track between two
    // file-borne rooms is solid because both rooms work, but nothing has travelled it.
    const touched = line.stations.slice(Math.max(0, bestStart - 1), bestEnd);
    if (!touched.some((st) => st.state === "live")) return;

    const nodes = line.nodes.slice(bestStart, bestEnd + 1);
    if (nodes.length < 2) return;
    const d = linePath(nodes);
    if (!d) return;
    const seconds = Math.max(3, pathLength(nodes) / speed);
    dots.push({
      lineId: line.id,
      d,
      dur: `${Math.round(seconds * 10) / 10}s`,
      // NEGATIVE, and that is the whole trick. animateMotion positions by TRANSLATING the
      // element, so the translation adds to whatever coordinates the element already has --
      // the dot's own cx/cy must stay at the origin, which parks it in the top-left corner
      // for as long as a positive `begin` delays it. A negative offset means the animation
      // is already in progress on the first frame, so the dot is never anywhere it should
      // not be. Both halves of that were found by rendering the map and looking at it: the
      // first render parked a dot in the corner, and the render that "fixed" it by setting
      // cx/cy floated two dots in the whitespace between the lines.
      begin: `${-Math.round(i * 1.7 * 10) / 10}s`,
      r: 2.8,
    });
  });
  return dots;
}

/**
 * The data mode the whole map is drawn from. `sim` is the one case that takes a reserved
 * colour, and takes it correctly: --violet is the non-real family, and a map built from
 * simulated receipts is exactly that. It is spent on a chip and a frame, never on the
 * stations -- a hatched map would be unreadable, and unreadable is not the same as honest.
 * `background` comes back as a ready CSS value rather than a flag, so the view never has to
 * decide anything: the non-real family is always hatched (ADR-1313) and that rule belongs
 * next to the rule that picks the hue, not in a ternary inside a component.
 *
 * @param {string | undefined} mode
 * @returns {{ token: string, label: string, real: boolean, background: string }}
 */
export function modeChip(mode) {
  if (mode === "sim") return { token: "--mode-sim", label: "simulated", real: false, background: "var(--sim-hatch)" };
  if (mode === "replay") return { token: "--mode-replay", label: "replay", real: true, background: "none" };
  if (mode === "live") return { token: "--mode-live", label: "live", real: true, background: "none" };
  // Nobody said. The door reports its mode on every response, so an absent one means the
  // caller did not pass it on -- and drawing "live" because we were not told otherwise is
  // the same mistake as a green simulated number: a liveness claim with nothing behind it.
  //
  // The comment above was right and the code under it was wrong: this returned `real: true`,
  // which is that exact claim made by the branch written to refuse it. `real` answers "may a
  // reader treat what is drawn as real data", and the honest answer to a mode nobody stated
  // is no. It is NOT hatched, because hatching means the non-real FAMILY (simulated,
  // rehearsal, drill, exploratory) and "unstated" is none of those -- it is an absence of
  // evidence, which the label says in words.
  return { token: "--meta", label: "mode not stated", real: false, background: "none" };
}

/**
 * What the map claims about itself, in numbers a test can check against the registry.
 * @param {MapModel} model
 */
export function mapSummary(model) {
  let live = 0, unexercised = 0, fileBorne = 0, index = 0, planned = 0, template = 0, unknown = 0, interchanges = 0, receipts = 0;
  for (const s of model.stations) {
    if (s.state === "live") live += 1;
    else if (s.state === "unexercised") unexercised += 1;
    else if (s.state === "file-borne") fileBorne += 1;
    else if (s.state === "index") index += 1;
    else if (s.state === "planned") planned += 1;
    else if (s.state === "template") template += 1;
    else unknown += 1;
    if (s.transfers.length) interchanges += 1;
    receipts += s.receipts;
  }
  const n = model.stations.length;
  const sentence = `${n} station${n === 1 ? "" : "s"} on ${model.lines.length} line${model.lines.length === 1 ? "" : "s"}` +
    ` · ${live} running · ${unexercised} unexercised · ${planned} planned · ${fileBorne + index} file-borne or index · ${template} template` +
    (unknown ? ` · ${unknown} not measured` : "") +
    (n ? ". Every room in the registry is drawn; nothing is summarised away." : ".");
  return { stations: n, lines: model.lines.length, live, unexercised, fileBorne, index, planned, template, unknown, interchanges, receipts, sentence };
}

/** Reading order, which is also tab order: line by line, stop by stop, spur last on its line.
 * @param {MapModel} model @returns {string[]} */
export function focusOrder(model) {
  /** @type {string[]} */
  const ids = [];
  for (const line of model.lines) {
    for (const s of line.stations) ids.push(s.id);
    if (line.spur) ids.push(line.spur.id);
  }
  return ids;
}

/** @param {MapModel} model @param {string} id @returns {MapStation | null} */
export function stationById(model, id) {
  return model.stations.find((s) => s.id === id) ?? null;
}

/**
 * The Map room's own opening line, out of the registry the door served. If the registry does
 * not carry it -- which can only mean the map has been dropped from the contract that the
 * map exists to prove nothing is dropped from -- say exactly that rather than nothing.
 * @param {MapRoomInput[]} rooms
 * @param {MapRoomInput | null} [self] the Map room's own entry, when the caller already holds it
 * @returns {{ sentence: string, lede: string }}
 */
export function openingOf(rooms, self = null) {
  const room = (self && self.sentence ? self : null) ?? rooms.find((r) => r.id === MAP_ROOM_ID);
  if (room && typeof room.sentence === "string" && room.sentence) {
    return { sentence: room.sentence, lede: typeof room.lede === "string" ? room.lede : "" };
  }
  return {
    sentence: "If it is not on this map, it is not in the company.",
    lede: "the registry served by this door does not carry the Map room itself, which is the one omission this room cannot render around",
  };
}

/**
 * What the read-out strip under the map shows: one station when the reader is on one, and
 * the map's own claim about itself when they are not. Returning the fallback from here
 * rather than from the view is what keeps the view branchless -- and the fallback is not
 * filler, it is the sentence the whole room exists to make checkable.
 * @param {MapModel} model @param {string | null} activeId
 * @returns {{ id: string | null, title: string, sub: string, rows: { label: string, value: string }[] }}
 */
export function readout(model, activeId) {
  const s = activeId ? stationById(model, activeId) : null;
  if (s) return { id: s.id, title: s.name, sub: s.title, rows: s.rows };
  const sum = model.summary;
  return {
    id: null,
    title: `${sum.stations} rooms, ${sum.lines} lines`,
    sub: sum.sentence,
    rows: [
      { label: "running", value: `${sum.live} room${sum.live === 1 ? "" : "s"} · ${sum.receipts} receipt${sum.receipts === 1 ? "" : "s"}` },
      { label: "unexercised", value: `${sum.unexercised} built, never run` },
      { label: "planned", value: `${sum.planned} not built yet` },
      { label: "no log to count", value: `${sum.fileBorne} file-borne · ${sum.index} index · ${sum.template} template` },
      { label: "interchanges", value: `${sum.interchanges} rooms share an event kind with another` },
      ...(sum.unknown ? [{ label: "not measured", value: `${sum.unknown} rooms — the door has not answered for them` }] : []),
    ],
  };
}

// ---------------------------------------------------------------------------------------
// the legend
// ---------------------------------------------------------------------------------------

/**
 * @typedef {object} LegendRow
 * @property {string} id
 * @property {string} label
 * @property {string} means
 * @property {{ kind: "segment"|"station"|"weights"|"dot"|"note", pattern?: string, shape?: MapStation["shape"], halo?: boolean, core?: boolean }} mark
 */

/**
 * What every mark on this map means.
 *
 * A printed legend is a CHECKABLE CLAIM, which is the only reason it is worth printing:
 * `legendGaps()` walks the built model and reports any mark the renderer can draw that no
 * row here explains. A legend that is merely written is decoration; a legend that fails is a
 * gate.
 *
 * @type {readonly LegendRow[]}
 */
export const LEGEND = Object.freeze([
  {
    id: "solid",
    mark: { kind: "segment", pattern: "solid" },
    label: "running",
    means: "the rooms at both ends are built and at least one of their event kinds has fired.",
  },
  {
    id: "dashed",
    mark: { kind: "segment", pattern: "dashed" },
    label: "unexercised",
    means: "built and tested, and not one of its event kinds has ever fired. That is not a zero — a kind that has never run has no count at all.",
  },
  {
    id: "dotted",
    mark: { kind: "segment", pattern: "dotted" },
    label: "planned",
    means: "not built yet. The room is in the contract and opens when its trigger is met; the track into it is dotted for its whole length.",
  },
  {
    id: "pending",
    mark: { kind: "segment", pattern: "pending" },
    label: "not measured",
    means: "the door has not answered for this room. Drawn faint rather than drawn as running — unmeasured and empty are different facts.",
  },
  {
    id: "station",
    mark: { kind: "station", pattern: "solid", shape: "circle", halo: false, core: true },
    label: "a room",
    means: "one room, one stop. The filled centre means its kinds have actually fired; hollow means they have not, or that it homes none at all.",
  },
  {
    id: "interchange",
    mark: { kind: "station", pattern: "solid", shape: "circle", halo: true, core: true },
    label: "interchange",
    means: "this room shares an event kind with another room, so one receipt lands in both. Focus the station and the other rooms are named.",
  },
  {
    id: "index",
    mark: { kind: "station", pattern: "solid", shape: "diamond", halo: false, core: false },
    label: "index room",
    means: "renders a whole inventory rather than a slice of one — every lane, every concept. It homes no event kinds, which is why its centre is empty.",
  },
  {
    id: "template",
    mark: { kind: "station", pattern: "solid", shape: "square", halo: false, core: false },
    label: "template",
    means: "a shape every lane instantiates, not a room you can open. It hangs off a siding because it is in the company but is not a stop.",
  },
  {
    id: "weights",
    mark: { kind: "weights" },
    label: "the five rings",
    means: "each ring is a line, told apart by weight and by position — heaviest is the daily surface. Never by colour, so the map reads the same to a colour-blind reader.",
  },
  {
    id: "flight",
    mark: { kind: "dot" },
    label: "traffic",
    means: "a dot travels any line that has recorded a receipt. It does not move at all when your system asks for reduced motion.",
  },
  {
    id: "file-borne",
    mark: { kind: "note" },
    label: "file, not log",
    means: "some rooms read the tree and the contract instead of the log. They draw solid because they run, and carry no receipt count because the spine has nothing to say about them.",
  },
  {
    id: "colour",
    mark: { kind: "note" },
    label: "no reserved colour is spent here",
    means: "amber is needs-you, green is real money, red is an incident, violet is anything not real. Where a room sits is none of those, so this map spends none of them.",
  },
]);

/**
 * Every mark the model actually draws that the legend does not explain. Empty is the pass.
 * @param {MapModel} model
 * @returns {string[]}
 */
export function legendGaps(model) {
  /** @type {Set<string>} */
  const patterns = new Set();
  /** @type {Set<string>} */
  const shapes = new Set();
  let halo = false;
  let core = false;

  for (const line of model.lines) {
    for (const seg of line.segments) patterns.add(seg.pattern);
    for (const s of line.stations) { patterns.add(s.pattern); shapes.add(s.shape); halo = halo || s.halo; core = core || s.core; }
    if (line.spur) { patterns.add(line.spur.pattern); shapes.add(line.spur.shape); halo = halo || line.spur.halo; core = core || line.spur.core; }
  }

  /** @type {Set<string>} */
  const legendPatterns = new Set();
  /** @type {Set<string>} */
  const legendShapes = new Set();
  for (const row of LEGEND) {
    if (typeof row.mark.pattern === "string") legendPatterns.add(row.mark.pattern);
    if (typeof row.mark.shape === "string") legendShapes.add(row.mark.shape);
  }
  const legendHalo = LEGEND.some((r) => r.mark.halo === true);
  const legendCore = LEGEND.some((r) => r.mark.core === true);
  const legendDot = LEGEND.some((r) => r.mark.kind === "dot");
  const legendWeights = LEGEND.some((r) => r.mark.kind === "weights");

  /** @type {string[]} */
  const gaps = [];
  for (const p of patterns) if (!legendPatterns.has(p)) gaps.push(`stroke pattern "${p}" is drawn but has no legend row`);
  for (const s of shapes) if (!legendShapes.has(s)) gaps.push(`station shape "${s}" is drawn but has no legend row`);
  if (halo && !legendHalo) gaps.push("interchange halos are drawn but have no legend row");
  if (core && !legendCore) gaps.push("filled station centres are drawn but have no legend row");
  if (flightDots(model).length && !legendDot) gaps.push("flight dots are drawn but have no legend row");
  if (model.lines.length > 1 && !legendWeights) gaps.push("more than one line weight is drawn but no legend row explains weight");
  return gaps;
}

/**
 * Draw ops for the legend swatches, built by the same functions the map itself uses so a
 * swatch cannot drift from the mark it stands for.
 * @param {{ width?: number, height?: number }} [box]
 * @returns {{ id: string, label: string, means: string, ops: DrawOp[], width: number, height: number }[]}
 */
export function legendGeometry(box = {}) {
  const w = box.width ?? 46;
  const h = box.height ?? 22;
  const midY = h / 2;
  return LEGEND.map((row) => {
    /** @type {DrawOp[]} */
    const ops = [];
    if (row.mark.kind === "segment") {
      const pattern = row.mark.pattern ?? "solid";
      ops.push({ d: `M 2 ${midY} L ${w - 2} ${midY}`, dash: dashArray(pattern, 2.6), width: 2.6, fill: false, tone: pattern === "pending" ? "faint" : "line" });
    } else if (row.mark.kind === "station") {
      const shape = row.mark.shape ?? "circle";
      const r = shape === "square" ? MAP_GEOMETRY.squareR : shape === "diamond" ? MAP_GEOMETRY.diamondR : MAP_GEOMETRY.stationR;
      ops.push({ d: `M 2 ${midY} L ${w - 2} ${midY}`, dash: dashArray(row.mark.pattern ?? "solid", 2.2), width: 2.2, fill: false, tone: "line" });
      for (const op of stationOps(w / 2, midY, {
        pattern: /** @type {MapStation["pattern"]} */ (row.mark.pattern ?? "solid"),
        shape: /** @type {MapStation["shape"]} */ (shape),
        halo: row.mark.halo === true,
        core: row.mark.core === true,
        r,
        state: "live",
      }, 2.6)) ops.push(op);
    } else if (row.mark.kind === "weights") {
      LINE_WEIGHT.forEach((weight, i) => {
        const y = 3 + i * ((h - 6) / Math.max(1, LINE_WEIGHT.length - 1));
        ops.push({ d: `M 2 ${Math.round(y * 100) / 100} L ${w - 2} ${Math.round(y * 100) / 100}`, dash: null, width: weight, fill: false, tone: "line" });
      });
    } else if (row.mark.kind === "dot") {
      ops.push({ d: `M 2 ${midY} L ${w - 2} ${midY}`, dash: null, width: 2.6, fill: false, tone: "line" });
      ops.push({ d: stationPath("circle", w / 2, midY, 2.8), dash: null, width: 0, fill: true, tone: "station" });
    }
    return { id: row.id, label: row.label, means: row.means, ops, width: w, height: h };
  });
}
