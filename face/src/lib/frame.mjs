// frame.mjs -- the room frame's own decisions (face v3 P01; FV3-A · FV3-B · FV3-E).
//
// RoomFrame.tsx draws a room as tabs (Overview · Work) with an action strip above the module's View: one button per
// op and per session verb, each opening a drawer that holds exactly that one form. Which tabs exist, what the strip
// carries and what a not-ready session says are decided here, where node can import them with no install; the frame
// runs the effects and draws.

import { emptyPicker, NONE_YET } from "./ops.mjs";

/**
 * @typedef {"overview" | "records" | "work"} FrameTab
 * @typedef {{ kind: "op" | "session", id: string, label: string, ready: boolean, reason: string }} StripItem
 */

/** The tab every room opens on. @type {FrameTab} */
export const OVERVIEW = "overview";

/**
 * The tabs a room shows: Records only when the fold declares a collection (ADR-1365), Work only when the room has an
 * op or a session to put on it (FV3-B).
 * @param {number} opCount @param {number} sessionCount @param {number} [recordCount] @returns {FrameTab[]}
 */
export function frameTabs(opCount, sessionCount, recordCount = 0) {
  /** @type {FrameTab[]} */
  const tabs = ["overview"];
  if (recordCount > 0) tabs.push("records");
  if (opCount > 0 || sessionCount > 0) tabs.push("work");
  return tabs;
}

/** A tab's label. @param {FrameTab} tab @returns {string} */
export function tabLabel(tab) {
  return tab === "work" ? "Work" : tab === "records" ? "Records" : "Overview";
}

/**
 * The frame's sections, top to bottom (REQ-04): the action strip comes before the tab body, so a room's first verb is
 * never pushed below its content. Returned as data so a node check holds the order with no browser.
 * @returns {readonly ("tabs" | "strip" | "problems" | "body" | "drawer")[]}
 */
export function frameSections() {
  return ["tabs", "strip", "problems", "body", "drawer"];
}

/**
 * The tab to draw: the one picked for THIS room, else Overview -- a room change resets the frame (FV3-B), and a
 * picked tab the room no longer has falls back too.
 * @param {{ room: string, tab: string } | null} picked @param {string} roomId @param {FrameTab[]} tabs @returns {FrameTab}
 */
export function currentTab(picked, roomId, tabs) {
  if (!picked || picked.room !== roomId) return OVERVIEW;
  const t = /** @type {FrameTab} */ (picked.tab);
  return tabs.includes(t) ? t : OVERVIEW;
}

/**
 * Why a session verb whose process is not built cannot start (FV3-E): said on its strip button and on its card,
 * never hidden. Empty for a ready verb.
 * @param {{ ready: boolean, process: string }} card @returns {string}
 */
export function notReadyReason(card) {
  if (card.ready) return "";
  return card.process ? `needs process \`${card.process}\` — not built yet` : "needs a process — not built yet";
}

/**
 * The action strip (FV3-A): one item per op the module names, in its order, then one per session verb the door
 * serves for this room. An op the door has not answered for yet is labelled by its id.
 * @param {readonly unknown[]} opCards  lib/ops.mjs opCards() rows
 * @param {readonly unknown[]} sessionCards  lib/sessions.mjs sessionCards() rows
 * @returns {StripItem[]}
 */
export function stripItems(opCards, sessionCards) {
  /** @type {StripItem[]} */
  const out = [];
  for (const c of Array.isArray(opCards) ? opCards : []) {
    const o = /** @type {any} */ (c);
    if (!o || typeof o.id !== "string") continue;
    const label = typeof o.label === "string" && o.label ? o.label : o.id;
    // An op whose required picker has nothing to pick is not ready either (REQ-03): its button says so.
    const empty = emptyPicker(o);
    const ready = o.state !== "absent" && empty === null;
    out.push({ kind: "op", id: o.id, label, ready, reason: empty !== null ? `${empty.label}: ${NONE_YET}` : ready ? "" : String(o.why ?? "") });
  }
  for (const c of Array.isArray(sessionCards) ? sessionCards : []) {
    const s = /** @type {any} */ (c);
    if (!s || typeof s.id !== "string") continue;
    const ready = s.ready === true;
    out.push({ kind: "session", id: s.id, label: typeof s.label === "string" && s.label ? s.label : s.id, ready, reason: notReadyReason({ ready, process: typeof s.process === "string" ? s.process : "" }) });
  }
  return out;
}

/** The key that names one strip item (and the drawer it opens). @param {{ kind: string, id: string }} item @returns {string} */
export function itemKey(item) {
  return `${item.kind}:${item.id}`;
}
