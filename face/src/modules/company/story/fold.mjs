// fold.mjs -- company/story: every decision the story room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1337).
//
// v0.7's Story set the landing's nine explainer chapters inside HQ. Those chapters are the front door's prose, typed
// into the bundle; the served room's lede is "the cycles, in order", and the company already keeps that record: the
// logbook, docs/HISTORY.md. So this room reads it through the door -- the glance table of every cycle, the milestone
// tracker, and each entry as a chapter -- in the logbook's own order and words. The logbook is written when a cycle
// closes, so it can lag the company; the room says how far, rather than implying the book is complete.
import { fmtInt } from "../../../lib/inbox.mjs";
import { fileText, historyOf } from "../../../lib/company-room.mjs";
import { laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   doc: import("../../../lib/lane-room.mjs").SourceFile,
 *   isBookRead: boolean,
 *   chapters: import("../../../ui/company").ChapterView[],
 *   newest: string,
 *   newestCode: string,
 *   cycles: { key: string, code: string, name: string, dates: string, result: string, burn: string, shipped: string, hasCode: boolean }[],
 *   milestones: { key: string, milestone: string, status: string, isDone: boolean, isPending: boolean }[],
 *   isCyclesEmpty: boolean,
 *   isMilestonesEmpty: boolean,
 *   isChaptersEmpty: boolean,
 *   cyclesEmpty: string,
 *   milestonesEmpty: string,
 *   chaptersEmpty: string,
 *   lag: string,
 * }} Folded
 */

/** @param {string} what */
const NOT_CARRIED = (what) => `The logbook the door served carries no ${what}, so none is drawn here -- and none is claimed absent.`;
/** @param {string} what */
const NOT_READ = (what) => `The logbook carries a ${what} in a shape this reader cannot read, so none is drawn here -- and none is claimed absent.`;

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx);
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [];
  const file = fileText(payloads, ctx, "history", reads);
  const h = historyOf(file.text);
  const isBookRead = file.source.isRead && h.isRead;
  const chapters = isBookRead ? h.entries.map((e, i) => ({
    key: `${i}-${e.code || e.title}`,
    code: e.code,
    title: e.title,
    meta: [e.status, e.date, e.lane === "" ? "" : `lane ${e.lane}`].filter((x) => x !== "").join(" · "),
    body: e.body,
    hasCode: e.code !== "",
  })) : [];
  const cycles = isBookRead ? h.cycles.map((c, i) => ({ key: `${i}-${c.code || c.name}`, ...c, hasCode: c.code !== "" })) : [];
  const milestones = isBookRead ? h.milestones.map((m, i) => ({ key: `${i}-${m.milestone}`, ...m })) : [];
  const done = milestones.filter((m) => m.isDone).length;
  // How far the book lags: the glance rows with no chapter, matched by code AND name (the book carries two C6s and two
  // C7s), and the newest chapter named with its OWN date -- never one entry's code beside another's date (attack).
  const unwritten = h.cycles.filter((c) => !h.entries.some((e) => e.code === c.code && e.title === c.name)).length;
  const ne = h.newestEntry;
  const newestName = ne === null ? "" : `${ne.code === "" ? "" : `${ne.code} `}${ne.title}, closed ${ne.date}`;
  const lag = !isBookRead || ne === null ? ""
    : unwritten > 0 && !h.cyclesUnread
      ? `The newest chapter written is ${newestName}. ${fmtInt(unwritten)} initiative${unwritten === 1 ? "" : "s"} in the glance table ${unwritten === 1 ? "has" : "have"} a row and no chapter yet.`
      : `The newest chapter written is ${newestName}.`;
  return {
    ...base,
    reads: [...base.reads, ...reads],
    badge: isBookRead ? "the logbook · docs/HISTORY.md" : "the logbook · not read",
    kpis: [
      { key: "cycles", v: isBookRead && !h.cyclesUnread && h.cyclesMalformed === 0 ? fmtInt(cycles.length) : "—", l: "Initiatives in the book", sub: h.cyclesMalformed > 0 ? `${fmtInt(h.cyclesMalformed)} row${h.cyclesMalformed === 1 ? "" : "s"} this reader could not read` : "the glance table, closed or parked" },
      { key: "chapters", v: isBookRead && h.entriesState === "read" ? fmtInt(chapters.length) : "—", l: "Chapters written", sub: "one entry per closed cycle" },
      { key: "milestones", v: isBookRead && !h.milestonesUnread && h.milestonesUnmarked === 0 ? `${fmtInt(done)} of ${fmtInt(milestones.length)}` : "—", l: "Milestones reached", sub: h.milestonesUnmarked > 0 ? "a status carries no ✅ or ⏳ this count reads" : "the book's own tracker" },
      { key: "newest", v: isBookRead && h.newest !== "" ? h.newest : "—", l: "Newest chapter", sub: "the date its cycle closed" },
    ],
    doc: file.source,
    isBookRead,
    chapters,
    newest: isBookRead ? h.newest : "",
    newestCode: isBookRead && ne !== null ? ne.code : "",
    cycles,
    milestones,
    isCyclesEmpty: cycles.length === 0,
    isMilestonesEmpty: milestones.length === 0,
    isChaptersEmpty: chapters.length === 0,
    cyclesEmpty: !isBookRead ? "" : h.cyclesState === "absent" ? NOT_CARRIED("glance table") : NOT_READ("glance table"),
    milestonesEmpty: !isBookRead ? "" : h.milestonesState === "absent" ? NOT_CARRIED("milestone tracker") : NOT_READ("milestone tracker"),
    chaptersEmpty: !isBookRead ? "" : h.entriesState === "absent" ? NOT_CARRIED("Entries section") : NOT_READ("Entries section"),
    lag,
  };
}
