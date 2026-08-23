// shell.mjs -- the shell's decisions: where you are, how you got there, and what a key does.
//
// Dependency-free ESM, like every other lib module: CI cannot npm install, so a branch that
// lives inside a .tsx is a branch nobody tests. Routing and the keyboard model are exactly
// the kind of thing that breaks quietly and is never noticed in a screenshot, so they live
// here where a node test can hold them.

/** The room the shell falls back to when a URL names nothing real. */
export const HOME = "today";

/**
 * A day, and only a day. The door's own `parseAsof` refuses anything else by name, so this
 * exists to stop the shell putting a malformed value in the address bar in the first place --
 * a refusal you never provoke is better than one you surface well.
 */
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;


/**
 * The address bar is the FRAGMENT, not the path.
 *
 * Two reasons, and both are load-bearing. The door hands its dev token over in the fragment
 * (`#token=...`) and a fragment is never sent to a server, so keeping the whole address
 * there means a room name can never end up in a proxy log beside a token. And the app is
 * served by a static build with no server-side routing, so a path-based route would 404 on
 * reload -- the failure that makes a person distrust the whole surface.
 *
 * Shape: `#/<room>` with the token, when present, riding alongside as `token=...`.
 *
 * @param {string} hash
 * @returns {{ room: string | null, token: string | null, asOf: string | null }}
 */
export function parseHash(hash) {
  if (typeof hash !== "string" || !hash) return { room: null, token: null, asOf: null };
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  let room = null;
  let token = null;
  let asOf = null;
  for (const part of raw.split("&")) {
    if (!part) continue;
    if (part.startsWith("/")) {
      const id = part.slice(1).trim();
      if (id) room = decodeURIComponent(id);
      continue;
    }
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    const v = decodeURIComponent(part.slice(eq + 1));
    if (k === "token" && v) token = v;
    // The scrub travels in the ADDRESS, so a scrubbed view is a link someone can send or
    // reload into. A time machine you cannot bookmark is a toy.
    if (k === "asof" && ISO_DAY.test(v)) asOf = v;
    // A bare `#token=...` with no room is what arc-dash prints. That is not an error and
    // must not be treated as "no route" -- it is the home route with a token attached.
  }
  return { room, token, asOf };
}

/**
 * Build the fragment for a room, carrying the token AND the scrub through so navigating never
 * drops either. A scrubbed view that reverted to live the moment you changed room would make
 * the time machine useless for the thing it is for: reading one past day across the company.
 * @param {string} room
 * @param {string | null} [token]
 * @param {string | null} [asOf]
 * @returns {string}
 */
export function buildHash(room, token = null, asOf = null) {
  const parts = [`/${encodeURIComponent(room)}`];
  if (token) parts.push(`token=${encodeURIComponent(token)}`);
  if (typeof asOf === "string" && ISO_DAY.test(asOf)) parts.push(`asof=${asOf}`);
  return `#${parts.join("&")}`;
}

/**
 * What the as-of control should SAY about the day it is set to.
 *
 * Three cases and they are not the same fact. A sealed day replays byte-identically. TODAY is
 * still being written, so a read of it is a snapshot and the product must not imply the
 * stronger guarantee. And "live" is not a time at all.
 *
 * @param {string | null} asOf @param {string | null} today  the door's own day, never the browser's
 * @returns {{ scrubbed: boolean, label: string, note: string, replayIdentical: boolean }}
 */
export function asOfState(asOf, today) {
  if (typeof asOf !== "string" || !ISO_DAY.test(asOf))
    return { scrubbed: false, label: "live", note: "reading the log as it stands now", replayIdentical: false };
  if (today !== null && asOf === today)
    return {
      scrubbed: true, label: asOf, replayIdentical: false,
      note: "today is still being written, so this is a snapshot of an open day — it is not guaranteed to replay to the same bytes, and that is a different promise from a sealed day",
    };
  return {
    scrubbed: true, label: asOf, replayIdentical: true,
    note: "a sealed day: every spine-derived view here is rebuilt from the log and replays to the same bytes",
  };
}

/**
 * A flat, ordered list of room ids in nav order, so the keyboard can walk them without
 * knowing anything about rings. Groups come from rooms.byRing, which already drops the lane
 * template and sinks planned rooms.
 * @param {{ ring: string, rooms: { id: string }[] }[]} groups
 * @returns {string[]}
 */
export function navOrder(groups) {
  const ids = [];
  for (const g of groups) for (const r of g.rooms) ids.push(r.id);
  return ids;
}

/**
 * The keyboard model.
 *
 * Deliberately SMALL. Every key here is one a person can hold in their head; anything more
 * is a shortcut nobody uses that still shadows a browser default. j/k move between rooms
 * because that is what they do in the Inbox too -- one motion vocabulary for the whole
 * product, not one per screen.
 *
 * Returns an ACTION rather than performing one, so the whole model is assertable without a
 * DOM. `null` means "not ours" and the event must be left alone.
 *
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean }} ev
 * @param {{ inTextField: boolean, paletteOpen: boolean }} ctx
 * @returns {{ type: string, delta?: number, room?: string } | null}
 */
export function keyAction(ev, ctx) {
  const mod = ev.metaKey === true || ev.ctrlKey === true;

  // The palette is the one binding that must work from ANYWHERE, including a text field --
  // it is how you leave a screen you are stuck on.
  if (mod && (ev.key === "k" || ev.key === "K")) return { type: "palette-toggle" };

  if (ctx.paletteOpen) {
    if (ev.key === "Escape") return { type: "palette-close" };
    return null; // the palette owns its own keys while it is open
  }

  // NOTHING else fires while the owner is typing. A reason box that eats "r" and rejects the
  // approval is not a shortcut, it is a trap -- and this product's one write is irreversible.
  if (ctx.inTextField) return null;

  if (ev.altKey || mod) return null;

  switch (ev.key) {
    case "j": case "ArrowDown": return { type: "room-move", delta: 1 };
    case "k": case "ArrowUp": return { type: "room-move", delta: -1 };
    case "g": return { type: "room-open", room: HOME };
    case "?": return { type: "help-toggle" };
    case "Escape": return { type: "escape" };
    default: return null;
  }
}

/**
 * Move within the nav order WITHOUT wrapping.
 *
 * Wrapping was the obvious choice and is the wrong one: holding j to reach the end of the
 * company and silently arriving back at Today teaches the owner that the list has no end,
 * which is the opposite of what a coverage-first product should say. Stopping at the edge is
 * how you learn there IS an edge.
 *
 * @param {string[]} order @param {string} current @param {number} delta
 * @returns {string} the room to open (unchanged at either end)
 */
export function moveRoom(order, current, delta) {
  if (!order.length) return current;
  const i = order.indexOf(current);
  if (i === -1) return order[0] ?? current;
  const next = i + delta;
  if (next < 0 || next >= order.length) return current;
  return order[next] ?? current;
}

/**
 * Whether an event came from somewhere the owner is typing. Checked by SHAPE rather than by
 * tag name alone: contenteditable is not an input, and a select does need its own arrows.
 * @param {{ tagName?: string, isContentEditable?: boolean } | null | undefined} el
 */
export function isTextField(el) {
  if (!el) return false;
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Everything the palette can find, in one flat list.
 *
 * The Map is how you SEE that nothing is missing; this is how you REACH it. Thirty-three
 * rooms in five rings is navigable, but a hundred and seven concepts are not -- and the
 * contract anchors every one of them to a room AND a station precisely so a search can land
 * you in the right part of the right room rather than merely near it.
 *
 * Concepts come from the frozen contract, served over the door's allow-listed file route.
 * That is the same file `face-coverage` validates, so the palette cannot disagree with the
 * gate about what exists -- a search index with its own copy of the vocabulary would be a
 * second spelling, and the one thing this product must never do is quietly know less than
 * arc does.
 *
 * @param {{ id: string, name: string, ring: string, sentence?: string, template?: boolean }[]} rooms
 * @param {Record<string, { room: string, station: string }>} [concepts]
 * @returns {{ id: string, label: string, hint: string, kind: "room" | "concept", room: string, station?: string }[]}
 */
export function paletteItems(rooms, concepts = {}) {
  /** @type {{ id: string, label: string, hint: string, kind: "room" | "concept", room: string, station?: string }[]} */
  const out = [];
  const known = new Set();
  for (const r of rooms) {
    known.add(r.id);
    // The lane TEMPLATE is reachable HERE but not in the rail, and the difference is exact:
    // the rail lists places in the company's structure, and a template is a shape every lane
    // instantiates rather than one of them. But it is a real thing the contract names, EIGHT
    // concepts are anchored in it, and excluding it from search made those eight words
    // unfindable -- 131 items where the contract has 139. A product whose entire claim is
    // that nothing is missing cannot have eight of its own words be unsearchable.
    out.push({
      id: `room:${r.id}`,
      label: r.name,
      hint: r.template ? "the shape every lane instantiates" : `${r.ring} · ${r.sentence ?? ""}`,
      kind: "room",
      room: r.id,
    });
  }
  for (const [term, anchor] of Object.entries(concepts || {})) {
    if (!anchor || typeof anchor.room !== "string") continue;
    // A concept homed in a room that does not exist would be a result that opens nothing.
    // face-coverage now fails closed on exactly this, so it should be impossible -- which is
    // the reason to skip it here rather than render it: if the gate ever regresses, the
    // palette must not become the place the corruption is laundered into a working link.
    if (!known.has(anchor.room)) continue;
    out.push({
      id: `concept:${term}`,
      label: term,
      hint: `${anchor.room} · ${anchor.station}`,
      kind: "concept",
      room: anchor.room,
      station: anchor.station,
    });
  }
  return out;
}

/**
 * Pull the concept map out of the frozen contract as the door serves it.
 *
 * `/api/file/expected-set` returns `{ text }` -- the file's bytes, HTML-escaped like every
 * other string the door sends. Parsing it here rather than in a component keeps the failure
 * modes assertable: a body that is not JSON, a contract without a concepts map, and a
 * concepts map that is not an object are three different problems and each gets its own
 * refusal rather than a blank list.
 *
 * @param {unknown} body
 * @param {(s: unknown) => string} unescape  the door's own decoder, injected so this file
 *                                           stays dependency-free and testable
 * @returns {{ ok: true, concepts: Record<string, { room: string, station: string }> } | { ok: false, code: string, human: string }}
 */
export function conceptsFromContract(body, unescape) {
  const text = body && typeof body === "object" ? /** @type {{ text?: unknown }} */ (body).text : undefined;
  if (typeof text !== "string" || !text.trim())
    return { ok: false, code: "BAD_BODY", human: "the door served no contract text to read the vocabulary from" };
  let parsed;
  try { parsed = JSON.parse(unescape(text)); } catch {
    return { ok: false, code: "BAD_JSON", human: "the frozen contract did not parse as JSON" };
  }
  const map = parsed && parsed.concepts && parsed.concepts.map;
  if (!map || typeof map !== "object")
    return { ok: false, code: "CONTRACT_SHAPE", human: "the contract carries no concepts map, so there is no vocabulary to search" };
  return { ok: true, concepts: map };
}

/**
 * Rank rooms and concepts for the command palette.
 *
 * A prefix match beats a word-start match beats a substring, and ties break on the shorter
 * label -- so typing "spi" puts the Spine room above "spine health", which is what someone
 * typing three letters meant. Case-insensitive, and it never throws on a weird query.
 *
 * @template {{ id: string, label: string, hint?: string }} T
 * @param {T[]} items @param {string} query @param {number} [limit]
 * @returns {T[]}
 */
export function rankMatches(items, query, limit = 12) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  /** @type {{ item: T, score: number }[]} */
  const scored = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    const hint = (item.hint ?? "").toLowerCase();
    let score = -1;
    if (label.startsWith(q)) score = 0;
    else if (label.includes(` ${q}`) || label.includes(`-${q}`) || label.includes(`.${q}`)) score = 1;
    else if (label.includes(q)) score = 2;
    else if (hint.includes(q)) score = 3;
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => (a.score - b.score) || (a.item.label.length - b.item.label.length));
  return scored.slice(0, limit).map((s) => s.item);
}
