// shell.mjs -- the shell's decisions: where you are, how you got there, and what a key does.
//
// Dependency-free ESM, like every other lib module: CI cannot npm install, so a branch that
// lives inside a .tsx is a branch nobody tests. Routing and the keyboard model are exactly
// the kind of thing that breaks quietly and is never noticed in a screenshot, so they live
// here where a node test can hold them.

/** The room the shell falls back to when a URL names nothing real. */
export const HOME = "today";

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
 * @returns {{ room: string | null, token: string | null }}
 */
export function parseHash(hash) {
  if (typeof hash !== "string" || !hash) return { room: null, token: null };
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  let room = null;
  let token = null;
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
    // A bare `#token=...` with no room is what arc-dash prints. That is not an error and
    // must not be treated as "no route" -- it is the home route with a token attached.
  }
  return { room, token };
}

/**
 * Build the fragment for a room, carrying the token through so navigating never drops it.
 * @param {string} room @param {string | null} [token]
 */
export function buildHash(room, token = null) {
  const parts = [`/${encodeURIComponent(room)}`];
  if (token) parts.push(`token=${encodeURIComponent(token)}`);
  return `#${parts.join("&")}`;
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
  if (i === -1) return order[0];
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
