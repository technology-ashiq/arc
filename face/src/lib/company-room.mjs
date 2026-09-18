// company-room.mjs -- the company ring's readers: the files it is drawn from, read the way a person reads them
// (face v2 Phase 03, company ring; PLAN-face-v2 section 5.2, ADR-1320, ADR-1324).
//
// PLAN-face-v2 section 5.2 gives law, strategy, concepts and story the allow-listed file route as their source: the
// constitution, the portfolio and the logbook are documents, and the room that is about a document reads it. These
// readers take the text the door served -- un-escaped ONCE -- and return what it says, in its own order and words.
// Nothing is typed here that the file does not carry, and there are three answers, never two: a section the file does
// not carry is ABSENT, a section it carries in a shape this reader cannot read is UNREADABLE, and only a section read
// is a list -- so a parser that goes quiet can never print "0" (company ring attack). A count is only ever the number
// of things actually read.
//
// Dependency-free like every lib module: node imports it with no install, and a decision here is a decision a test
// can hold (tests/face/company-ring.mjs).
import { unescapeDoorText } from "./door.mjs";
import { payloadOf, readProblem } from "./registry.mjs";
import { heldAcrossRooms, roomLink, sourceFile } from "./lane-room.mjs";

/**
 * @typedef {import("./registry.mjs").Payload} Payload
 * @typedef {import("./registry.mjs").Read} Read
 * @typedef {import("./registry.mjs").FoldContext} FoldContext
 * @typedef {import("./lane-room.mjs").SourceFile} SourceFile
 *
 * @typedef {{ id: string, name: string, text: string }} Article
 * @typedef {object} Constitution
 * @property {boolean} isRead
 * @property {string} version
 * @property {string[]} precedence
 * @property {string} adoption
 * @property {Article[]} eternal
 * @property {Article[]} working
 * @property {string[]} amendment
 * @property {string[]} teeth
 * @property {string[]} unread       the sections the file does not carry, by name
 * @property {string[]} unreadable   the sections it carries in a shape this reader cannot read, by name
 *
 * @typedef {{ code: string, title: string, status: string, date: string, lane: string, body: string[] }} Chapter
 * @typedef {{ code: string, name: string, dates: string, result: string, burn: string, shipped: string }} Cycle
 * @typedef {{ milestone: string, status: string, isDone: boolean, isPending: boolean }} Milestone
 * @typedef {"absent" | "unreadable" | "read"} SectionState
 * @typedef {object} History
 * @property {boolean} isRead
 * @property {boolean} unread         no Entries section at all
 * @property {SectionState} entriesState
 * @property {Chapter[]} entries
 * @property {string} newest          the newest REAL closing date among the chapters
 * @property {Chapter | null} newestEntry  the chapter that date belongs to
 * @property {Cycle[]} cycles
 * @property {SectionState} cyclesState
 * @property {number} cyclesMalformed rows of the glance table this reader could not read
 * @property {boolean} cyclesUnread
 * @property {Milestone[]} milestones
 * @property {SectionState} milestonesState
 * @property {boolean} milestonesUnread
 * @property {number} milestonesUnmarked  statuses carrying neither mark the count reads
 *
 * @typedef {{ band: string, lane: string, isLane: boolean, isOpen: boolean, owner: string, note: string, brief: string }} Band
 * @typedef {object} Bands
 * @property {boolean} isRead
 * @property {boolean} unread         no band table, or none this reader could read
 * @property {Band[]} rows
 * @property {string[]} malformed     table rows this reader could not read, as written
 * @property {string[]} duplicates    bands claimed on more than one row
 * @property {string[]} unverified    backticked names no lane the reader was given carries
 *
 * @typedef {{ term: string, room: string, station: string, isHomed: boolean }} Term
 * @typedef {object} Glossary
 * @property {boolean} isRead
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {Term[]} terms
 * @property {{ room: string, name: string, terms: Term[] }[]} byRoom
 * @property {Term[]} unhomed
 * @property {number} count
 * @property {number} unreadable      entries of the map this reader could not read
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });
const LANE = /^[a-z][a-z0-9-]*$/;
/** Windows device names pass the lane grammar and are never lanes (.claude/rules/lanes.md). */
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
/** Characters a person cannot see: a name made only of them is no name (money ring attack). */
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

/** @param {unknown} s @returns {s is string} */
const isLaneName = (s) => typeof s === "string" && LANE.test(s) && !RESERVED.test(s);

/**
 * A real calendar date in YYYY-MM-DD, or "" -- the shape alone let "2026-19-45" win "newest" (company ring attack).
 * @param {string} s @returns {string}
 */
export function realDate(s) {
  const m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(String(s));
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** A markdown line as a person reads it: no emphasis marks, no code ticks, single spaces. @param {unknown} s @returns {string} */
const plain = (s) => String(s).replace(/\*\*/g, "").replace(/(^|[^\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/g, "$1$2").replace(/`/g, "").replace(/\s+/g, " ").trim();

/**
 * The sections of a markdown text under one heading level, by title, in order. A title is the heading's text; the
 * body is every line up to the next heading of the same level or higher.
 * @param {string} text @param {number} level
 * @returns {{ title: string, lines: string[] }[]}
 */
function sections(text, level) {
  const head = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`);
  const higher = new RegExp(`^#{1,${level}}\\s`);
  /** @type {{ title: string, lines: string[] }[]} */
  const out = [];
  /** @type {{ title: string, lines: string[] } | null} */
  let cur = null;
  for (const line of text.split("\n")) {
    const m = head.exec(line);
    if (m) { cur = { title: m[1] ?? "", lines: [] }; out.push(cur); continue; }
    if (higher.test(line)) { cur = null; continue; }
    if (cur) cur.lines.push(line);
  }
  return out;
}

/**
 * The first section whose title starts with `prefix` (case-sensitive: the file's own spelling), or null.
 * @param {{ title: string, lines: string[] }[]} list @param {string} prefix
 * @returns {{ title: string, lines: string[] } | null}
 */
const sectionOf = (list, prefix) => list.find((s) => s.title.startsWith(prefix)) ?? null;

/**
 * The items of a section -- "- " or "1. " lines, each with its indented continuation lines joined on; a section
 * written as prose is read as its paragraphs instead. Empty only when the section carries nothing.
 * @param {string[]} lines @returns {string[]}
 */
function listItems(lines) {
  /** @type {string[]} */
  const items = [];
  for (const line of lines) {
    if (/^(?:[-*]|\d+\.)\s+/.test(line)) items.push(line.replace(/^(?:[-*]|\d+\.)\s+/, ""));
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  if (items.length > 0) return items.map(plain).filter((s) => s !== "");
  /** @type {string[]} */
  const paras = [];
  let cur = "";
  for (const line of lines) {
    if (line.trim() === "" || /^-{3,}$/.test(line.trim())) { if (cur !== "") paras.push(cur); cur = ""; continue; }
    cur = cur === "" ? line.trim() : `${cur} ${line.trim()}`;
  }
  if (cur !== "") paras.push(cur);
  return paras.map(plain).filter((s) => s !== "");
}

/**
 * The articles of a section: a bold "ID · Name." line (the separator may be a middle dot or a dash), then its text up
 * to the next article or the section's end.
 * @param {string[]} lines @returns {Article[]}
 */
function articles(lines) {
  /** @type {Article[]} */
  const out = [];
  for (const line of lines) {
    const m = /^\*\*([A-Z]\d+)\s+[·—–-]\s+(.+?)\*\*\s*(.*)$/.exec(line);
    if (m) {
      out.push({ id: m[1] ?? "", name: plain(m[2] ?? "").replace(/\.$/, ""), text: plain(m[3] ?? "") });
      continue;
    }
    const last = out[out.length - 1];
    if (last && line.trim() !== "" && !/^-{3,}$/.test(line.trim())) last.text = plain(`${last.text} ${line}`);
  }
  return out;
}

/**
 * The constitution, read from its own text: version, precedence, adoption line, the articles in both tiers, how an
 * amendment is made and the teeth. A section the file does not carry is named in `unread`; one it carries in a shape
 * this reader cannot read is named in `unreadable` -- neither is ever read as "no articles" (company ring).
 * @param {string | null} text  the file's text, already un-escaped
 * @returns {Constitution}
 */
export function constitutionOf(text) {
  /** @type {Constitution} */
  const empty = { isRead: false, version: "", precedence: [], adoption: "", eternal: [], working: [], amendment: [], teeth: [], unread: [], unreadable: [] };
  if (typeof text !== "string" || text.trim() === "") return empty;
  const t = text.replace(/\r\n/g, "\n");
  const lines = t.split("\n");
  // The version is the document's own title -- its first line -- never a later heading (company ring attack).
  const first = lines.find((l) => l.trim() !== "") ?? "";
  const version = (/^#\s.*\((v[0-9][0-9.]*)\)\s*$/.exec(first) || [])[1] ?? "";
  const prec = /Precedence:\s*\*\*([^*]+)\*\*/.exec(t);
  const precedence = prec ? (prec[1] ?? "").replace(/\.\s*$/, "").split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean) : [];
  // The adoption line is the quoted paragraph that starts at "Adoption status:", read to the end of THAT quote --
  // never glued to a later quote elsewhere in the file (company ring attack).
  const at = lines.findIndex((l) => /^>\s?Adoption status:/.test(l));
  /** @type {string[]} */
  const adoptionLines = [];
  if (at >= 0) {
    for (let i = at; i < lines.length; i++) {
      const l = lines[i] ?? "";
      if (!l.startsWith(">")) break;
      const body = l.replace(/^>\s?/, "");
      if (body.trim() === "") break;
      adoptionLines.push(body);
    }
  }
  const h2 = sections(t, 2);
  /** @type {string[]} */
  const unread = [];
  /** @type {string[]} */
  const unreadable = [];
  /**
   * @template T
   * @param {string} key @param {string} prefix @param {(lines: string[]) => T[]} read
   * @returns {T[]}
   */
  const section = (key, prefix, read) => {
    const s = sectionOf(h2, prefix);
    if (!s) { unread.push(key); return []; }
    const got = read(s.lines);
    if (got.length === 0) { unreadable.push(key); return []; }
    return got;
  };
  const eternal = section("eternal", "Eternal articles", articles);
  const working = section("working", "Working articles", articles);
  const amendment = section("amendment", "Amendment process", listItems);
  const teeth = section("enforcement", "Enforcement", listItems);
  return { isRead: true, version, precedence, adoption: plain(adoptionLines.join(" ")), eternal, working, amendment, teeth, unread, unreadable };
}

/**
 * The first markdown table in a section: its body rows (every "|"-delimited line after the header's separator, each
 * cell read as a person reads it), whether a separator was found, and how many body rows had the wrong cell count.
 * Reading stops at the end of that table: a second table is never merged into the first.
 * @param {string[]} lines @param {number} cells  the cell count a body row must have
 * @returns {{ rows: string[][], hasTable: boolean, malformed: number }}
 */
function tableOf(lines, cells) {
  /** @type {string[][]} */
  const rows = [];
  let seenRule = false;
  let inTable = false;
  let malformed = 0;
  for (const line of lines) {
    const isRow = /^\|.*\|\s*$/.test(line.trim());
    if (!isRow) { if (inTable) break; continue; }
    inTable = true;
    if (/^\|[\s:|-]+\|\s*$/.test(line.trim())) { seenRule = true; continue; }
    if (!seenRule) continue;
    const cellsOf = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => plain(c));
    if (cellsOf.length !== cells) { malformed++; continue; }
    rows.push(cellsOf);
  }
  return { rows, hasTable: seenRule, malformed };
}

/**
 * The logbook's entries, in the logbook's order: each "###" heading under "## Entries" is a chapter -- its cycle code
 * when it has one, its title, the status and date it closed with, the lane it names -- and its lines are the body.
 * An entry with no cycle code keeps none; nothing is invented for it. The glance table and the milestone tracker are
 * read as tables, each ABSENT, UNREADABLE or read (company ring).
 * @param {string | null} text @returns {History}
 */
export function historyOf(text) {
  /** @type {History} */
  const none = {
    isRead: false, unread: false, entriesState: "absent", entries: [], newest: "", newestEntry: null,
    cycles: [], cyclesState: "absent", cyclesMalformed: 0, cyclesUnread: false,
    milestones: [], milestonesState: "absent", milestonesUnread: false, milestonesUnmarked: 0,
  };
  if (typeof text !== "string" || text.trim() === "") return none;
  const t = text.replace(/\r\n/g, "\n");
  const h2 = sections(t, 2);
  const glanceS = sectionOf(h2, "At a glance");
  const glance = glanceS ? tableOf(glanceS.lines, 6) : { rows: [], hasTable: false, malformed: 0 };
  const cycles = glance.rows.map((c) => ({
    code: /^C\d+$/.test(c[0] ?? "") ? (c[0] ?? "") : "", name: c[1] ?? "", dates: c[2] ?? "", result: c[3] ?? "", burn: c[4] ?? "", shipped: c[5] ?? "",
  }));
  /** @type {SectionState} */
  const cyclesState = !glanceS ? "absent" : cycles.length === 0 ? "unreadable" : "read";
  const milestoneS = sectionOf(h2, "Milestone tracker");
  const tracker = milestoneS ? tableOf(milestoneS.lines, 2) : { rows: [], hasTable: false, malformed: 0 };
  const milestones = tracker.rows.map((c) => ({
    milestone: c[0] ?? "", status: c[1] ?? "", isDone: (c[1] ?? "").startsWith("✅"), isPending: (c[1] ?? "").startsWith("⏳"),
  }));
  /** @type {SectionState} */
  const milestonesState = !milestoneS ? "absent" : milestones.length === 0 ? "unreadable" : "read";
  const tables = {
    cycles, cyclesState, cyclesMalformed: glance.malformed, cyclesUnread: cyclesState !== "read",
    milestones, milestonesState, milestonesUnread: milestonesState !== "read",
    milestonesUnmarked: milestones.filter((m) => !m.isDone && !m.isPending).length,
  };
  const entriesS = sectionOf(h2, "Entries");
  if (!entriesS) return { ...none, ...tables, isRead: true, unread: true, entriesState: "absent" };
  const h3 = sections(entriesS.lines.join("\n"), 3);
  const entries = h3.map((s) => {
    // A title may carry its own dash ("The Developer — the intelligence layers"), so the split is at the LAST dash
    // that a capitalised status follows, never the first.
    const split = /^(.*)\s—\s([A-Z]{3,}\b.*)$/.exec(s.title);
    const head = (split ? (split[1] ?? "") : s.title).trim();
    const tail = split ? (split[2] ?? "") : "";
    const codeM = /^(C\d+)\s+·\s+(.*)$/.exec(head);
    const status = (/^([A-Z][A-Z -]*[A-Z])\b/.exec(tail.trim()) || [])[1] ?? "";
    const lane = (/lane\s+`([a-z][a-z0-9-]*)`/.exec(tail) || [])[1] ?? "";
    /** @type {string[]} */
    const body = [];
    for (const line of s.lines) {
      if (line.trim() === "" || /^-{3,}$/.test(line.trim())) { if (body.length && body[body.length - 1] !== "") body.push(""); continue; }
      if (/^\s+\S/.test(line) && body.length && body[body.length - 1] !== "") body[body.length - 1] += ` ${line.trim()}`;
      else if (body.length && body[body.length - 1] !== "" && !/^(?:[-*]|\d+\.)\s/.test(line)) body[body.length - 1] += ` ${line.trim()}`;
      else body.push(line.trim());
    }
    return {
      code: codeM ? (codeM[1] ?? "") : "",
      title: plain(codeM ? (codeM[2] ?? "") : head),
      status,
      date: realDate(tail),
      lane: isLaneName(lane) ? lane : "",
      body: body.map((b) => plain(b.replace(/^(?:[-*]|\d+\.)\s+/, ""))).filter((b) => b !== ""),
    };
  });
  /** @type {SectionState} */
  // An Entries section with no "###" chapter this reader can read -- "####" headings, prose -- is unreadable, never a
  // company with no history (company ring attack).
  const entriesState = entries.length > 0 ? "read" : "unreadable";
  // The newest chapter is the one with the latest REAL date, and its code travels with that date -- a code from one
  // entry never sits beside another entry's date (company ring attack).
  const newestEntry = entries.filter((e) => e.date !== "").reduce((/** @type {Chapter | null} */ a, e) => (a === null || e.date > a.date ? e : a), null);
  return { ...tables, isRead: true, unread: false, entriesState, entries, newest: newestEntry ? newestEntry.date : "", newestEntry };
}

/**
 * A band row's note in a line: when and how the century was claimed, and how much of it is taken -- the part a
 * person scans the map for. The whole note stays on the row; a note that is not a claim keeps its first sentence when
 * that is short, and otherwise says nothing rather than cutting a sentence in half.
 * @param {string} note @returns {string}
 */
function briefOf(note) {
  const claimed = /claimed at birth, (\d{4}-\d{2}-\d{2})/.exec(note);
  const taken = /\((\d{4}[–—-]\d{4}) taken/.exec(note);
  if (claimed) return `claimed ${claimed[1]}${taken ? ` · ${taken[1]} taken` : ""}`;
  const first = (note.split(/(?<=\.)\s|;\s/)[0] ?? "").trim();
  return first.length <= 110 ? first : "";
}

/**
 * The ADR century bands, read from PORTFOLIO.md's band table -- the record of which lane owns which century -- so the
 * map names the LANE (F1, ADR-1317 decision 4). A lane is a backticked name that STANDS as the row's owner (followed by
 * a dash, a bracket or nothing), is a lane name by the lanes rule, and -- when the caller knows the lanes -- is one of
 * them; anything else is drawn as what it is, never as a lane. The first table only; a row this reader cannot read is
 * named, never dropped, and a century claimed twice is named too (company ring attack).
 * @param {string | null} text @param {ReadonlySet<string> | null} [lanes]  the lanes to hold names against
 * @returns {Bands}
 */
export function bandsOf(text, lanes = null) {
  /** @type {Bands} */
  const empty = { isRead: false, unread: false, rows: [], malformed: [], duplicates: [], unverified: [] };
  if (typeof text !== "string" || text.trim() === "") return empty;
  const t = text.replace(/\r\n/g, "\n");
  const s = sectionOf(sections(t, 2), "ADR number bands");
  if (!s) return { ...empty, isRead: true, unread: true };
  /** @type {Band[]} */
  const rows = [];
  /** @type {string[]} */
  const malformed = [];
  /** @type {string[]} */
  const unverified = [];
  const seen = new Map();
  let seenRule = false;
  let inTable = false;
  for (const line of s.lines) {
    const raw = line.trim();
    const isRow = /^\|.*\|$/.test(raw);
    if (!isRow) { if (inTable) break; continue; }
    inTable = true;
    if (/^\|[\s:|-]+\|$/.test(raw)) { seenRule = true; continue; }
    if (!seenRule) continue;
    const m = /^\|\s*(\d{4})\s*[–—-]\s*(\d{4})\s*\|\s*(.*?)\s*\|$/.exec(raw);
    if (!m) { malformed.push(plain(raw)); continue; }
    const band = `${m[1]}–${m[2]}`;
    seen.set(band, (seen.get(band) ?? 0) + 1);
    const cell = m[3] ?? "";
    const laneM = /^`([^`]*)`(?=\s*(?:[—–-]|\(|$))\s*(.*)$/.exec(cell);
    const name = laneM ? (laneM[1] ?? "") : "";
    if (laneM && isLaneName(name) && (lanes === null || lanes.has(name))) {
      const note = plain(laneM[2] ?? "").replace(/^[—–-]\s*/, "");
      rows.push({ band, lane: name, isLane: true, isOpen: false, owner: name, note, brief: briefOf(note) });
      continue;
    }
    if (laneM && isLaneName(name)) unverified.push(name);
    const open = /^next lane to be born/i.test(cell.trim());
    const [owner, ...rest] = plain(cell).split(" — ");
    const whole = rest.join(" — ").trim();
    rows.push({ band, lane: "", isLane: false, isOpen: open, owner: (owner ?? "").trim(), note: whole, brief: briefOf(whole) });
  }
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([b]) => b);
  return { isRead: true, unread: rows.length === 0, rows, malformed, duplicates, unverified };
}

/**
 * The glossary, from the contract the door serves: every term with its room and station, grouped by the rooms the
 * shell draws in their order, and the terms whose room is not one of them -- or is the lane-room template, which is
 * not a room anyone opens -- counted out loud as unhomed. An entry that is not an object is not a term: it is counted
 * as unreadable, never as a word (company ring attack).
 * @param {string | null} text  the contract's text, already un-escaped
 * @param {readonly { id: string, name?: string, status?: string, template?: boolean }[]} rooms  the rooms the shell draws
 * @returns {Glossary}
 */
export function glossaryOf(text, rooms) {
  /** @type {Glossary} */
  const empty = { isRead: false, isRefused: false, refusal: NO_REFUSAL, terms: [], byRoom: [], unhomed: [], count: 0, unreadable: 0 };
  if (typeof text !== "string") return empty;
  /** @type {unknown} */
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    return { ...empty, isRefused: true, refusal: { code: "BAD_BODY", human: "the contract the door served does not parse, so no term is read from it" } };
  }
  const concepts = parsed !== null && typeof parsed === "object" ? /** @type {Record<string, unknown>} */ (parsed).concepts : undefined;
  const map = concepts !== null && typeof concepts === "object" ? /** @type {Record<string, unknown>} */ (concepts).map : undefined;
  if (map === null || typeof map !== "object" || Array.isArray(map))
    return { ...empty, isRefused: true, refusal: { code: "BAD_BODY", human: "the contract carries no concepts map, so no term is read from it" } };
  const homes = new Map((Array.isArray(rooms) ? rooms : []).filter((r) => r.template !== true && r.status !== "template").map((r) => [r.id, r]));
  /** @type {Term[]} */
  const terms = [];
  let unreadable = 0;
  for (const [term, v] of Object.entries(/** @type {Record<string, unknown>} */ (map))) {
    if (v === null || typeof v !== "object" || Array.isArray(v) || term.replace(INVISIBLE, "").trim() === "") { unreadable++; continue; }
    const o = /** @type {Record<string, unknown>} */ (v);
    const room = typeof o["room"] === "string" ? o["room"] : "";
    const station = typeof o["station"] === "string" ? o["station"].trim() : "";
    terms.push({ term, room, station, isHomed: room !== "" && homes.has(room) });
  }
  terms.sort((a, b) => a.term.localeCompare(b.term));
  const byRoom = [...homes.values()].map((r) => ({ room: r.id, name: typeof r.name === "string" && r.name !== "" ? r.name : r.id, terms: terms.filter((t) => t.room === r.id) })).filter((g) => g.terms.length > 0);
  return { isRead: true, isRefused: false, refusal: NO_REFUSAL, terms, byRoom, unhomed: terms.filter((t) => !t.isHomed), count: terms.length, unreadable };
}

/**
 * One allow-listed file for a company room: planned if the manifest may read it, its provenance as the door served
 * it, and its text un-escaped ONCE -- or the reason there is none. The body is copied ONCE, field by field, and both
 * the provenance and the text are read from that copy: validating one read of the body and drawing another let a body
 * pass as one file and draw another's text (company ring attack). The read joins `reads`.
 * @param {Record<string, Payload>} payloads @param {FoldContext} ctx @param {string} id @param {Read[]} reads
 * @returns {{ source: SourceFile, text: string | null }}
 */
export function fileText(payloads, ctx, id, reads) {
  /** @type {Read} */
  const read = { route: "/api/file/:id", param: id };
  const why = readProblem(read, ctx.manifest);
  if (why !== null) {
    return { source: { id, isReading: false, isRefused: true, isRead: false, refusal: { code: "READ_REFUSED", human: why }, path: "", sha: "", size: "" }, text: null };
  }
  reads.push(read);
  const p = payloadOf(payloads, read);
  if (p.state !== "ok") return { source: sourceFile(id, p), text: null };
  const data = p.data;
  const body = data !== null && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  const copy = { id: body["id"], path: body["path"], sha256: body["sha256"], text: body["text"] };
  const source = sourceFile(id, { state: "ok", data: copy });
  return { source, text: source.isRead && typeof copy.text === "string" ? unescapeDoorText(copy.text) : null };
}

/**
 * The lanes on the board, each once and each a lane name: a row with no readable name, or a name listed a second
 * time, is left out and counted -- never drawn as a nameless plan or a second copy of one (company ring attack).
 * @template {{ lane: string }} R
 * @param {readonly R[]} rows
 * @returns {{ rows: R[], dropped: number }}
 */
export function boardLanes(rows) {
  const seen = new Set();
  /** @type {R[]} */
  const kept = [];
  let dropped = 0;
  for (const r of rows) {
    if (!isLaneName(r.lane) || seen.has(r.lane)) { dropped++; continue; }
    seen.add(r.lane);
    kept.push(r);
  }
  return { rows: kept, dropped };
}

/**
 * Where a lane is drawn: the room the served registry homes the lane in (engine is drawn in the engine room, ledger in
 * money), else a room named for it -- the same answer the rail gives, never a guess.
 * @param {FoldContext} ctx
 * @returns {(lane: string) => { canOpen: boolean, room: string }}
 */
export function laneLinks(ctx) {
  const held = heldAcrossRooms(ctx, "lanes").rows;
  /** @type {Map<string, { canOpen: boolean, room: string }>} */
  const byLane = new Map();
  for (const r of held) if (!byLane.has(r.name)) byLane.set(r.name, { canOpen: r.canOpen, room: r.canOpen ? r.room : "" });
  return (lane) => byLane.get(lane) ?? roomLink(ctx, lane);
}
