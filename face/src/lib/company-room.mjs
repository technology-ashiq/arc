// company-room.mjs -- the company ring's readers: the files it is drawn from, read the way a person reads them
// (face v2 Phase 03, company ring; PLAN-face-v2 section 5.2, ADR-1320, ADR-1324).
//
// PLAN-face-v2 section 5.2 gives law, strategy, concepts and story the allow-listed file route as their source: the
// constitution, the portfolio and the logbook are documents, and the room that is about a document reads it. These
// readers take the text the door served -- un-escaped ONCE -- and return what it says, in its own order and words.
// Nothing is typed here that the file does not carry: a section the file does not have reads as UNREAD, never as an
// empty list, and a count is only ever the number of things actually read.
//
// Dependency-free like every lib module: node imports it with no install, and a decision here is a decision a test
// can hold (tests/face/company-ring.mjs).
import { unescapeDoorText } from "./door.mjs";
import { payloadOf, readProblem } from "./registry.mjs";
import { sourceFile } from "./lane-room.mjs";

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
 * @property {string[]} unread    the sections the file does not carry, by name
 *
 * @typedef {{ code: string, title: string, status: string, date: string, lane: string, body: string[] }} Chapter
 * @typedef {{ code: string, name: string, dates: string, result: string, burn: string, shipped: string }} Cycle
 * @typedef {{ milestone: string, status: string, isDone: boolean, isPending: boolean }} Milestone
 * @typedef {{ isRead: boolean, unread: boolean, entries: Chapter[], newest: string, cycles: Cycle[], cyclesUnread: boolean, milestones: Milestone[], milestonesUnread: boolean }} History
 *
 * @typedef {{ band: string, lane: string, isLane: boolean, isOpen: boolean, owner: string, note: string, brief: string }} Band
 * @typedef {{ isRead: boolean, unread: boolean, rows: Band[] }} Bands
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
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });
const LANE = /^[a-z][a-z0-9-]*$/;
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/;

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
 * The list items of a section -- "- " or "1. " lines, each with its indented continuation lines joined on.
 * @param {string[]} lines @returns {string[]}
 */
function listItems(lines) {
  /** @type {string[]} */
  const items = [];
  for (const line of lines) {
    if (/^(?:[-*]|\d+\.)\s+/.test(line)) items.push(line.replace(/^(?:[-*]|\d+\.)\s+/, ""));
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map(plain).filter((s) => s !== "");
}

/**
 * The articles of a section: a bold "ID · Name." line, then its text up to the next article or the section's end.
 * @param {string[]} lines @returns {Article[]}
 */
function articles(lines) {
  /** @type {Article[]} */
  const out = [];
  for (const line of lines) {
    const m = /^\*\*([A-Z]\d+)\s+·\s+(.+?)\*\*\s*(.*)$/.exec(line);
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
 * amendment is made and the teeth. A section the file does not carry is named in `unread` and left empty -- never
 * read as "no articles" (company ring).
 * @param {string | null} text  the file's text, already un-escaped
 * @returns {Constitution}
 */
export function constitutionOf(text) {
  /** @type {Constitution} */
  const empty = { isRead: false, version: "", precedence: [], adoption: "", eternal: [], working: [], amendment: [], teeth: [], unread: [] };
  if (typeof text !== "string" || text.trim() === "") return empty;
  const t = text.replace(/\r\n/g, "\n");
  const version = (/^#\s.*\((v[0-9][0-9.]*)\)/m.exec(t) || [])[1] ?? "";
  const prec = /Precedence:\s*\*\*([^*]+)\*\*/.exec(t);
  const precedence = prec ? (prec[1] ?? "").replace(/\.\s*$/, "").split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean) : [];
  // The adoption line is the quoted paragraph that starts at "Adoption status:", read to its blank quote line.
  const quote = t.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, ""));
  const at = quote.findIndex((l) => l.startsWith("Adoption status:"));
  /** @type {string[]} */
  const adoptionLines = [];
  if (at >= 0) for (let i = at; i < quote.length && (quote[i] ?? "").trim() !== ""; i++) adoptionLines.push(quote[i] ?? "");
  const h2 = sections(t, 2);
  /** @type {string[]} */
  const unread = [];
  const eternalS = sectionOf(h2, "Eternal articles");
  const workingS = sectionOf(h2, "Working articles");
  const amendS = sectionOf(h2, "Amendment process");
  const teethS = sectionOf(h2, "Enforcement");
  if (!eternalS) unread.push("eternal");
  if (!workingS) unread.push("working");
  if (!amendS) unread.push("amendment");
  if (!teethS) unread.push("enforcement");
  return {
    isRead: true,
    version,
    precedence,
    adoption: plain(adoptionLines.join(" ")),
    eternal: eternalS ? articles(eternalS.lines) : [],
    working: workingS ? articles(workingS.lines) : [],
    amendment: amendS ? listItems(amendS.lines) : [],
    teeth: teethS ? listItems(teethS.lines) : [],
    unread,
  };
}

/**
 * The body rows of the first markdown table in a section: every "|"-delimited line after the header's separator,
 * each cell read as a person reads it.
 * @param {string[]} lines @returns {string[][]}
 */
function tableRows(lines) {
  /** @type {string[][]} */
  const rows = [];
  let seenRule = false;
  for (const line of lines) {
    if (!/^\|.*\|\s*$/.test(line)) { if (seenRule && rows.length) break; continue; }
    if (/^\|[\s:|-]+\|\s*$/.test(line)) { seenRule = true; continue; }
    if (!seenRule) continue;
    rows.push(line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => plain(c)));
  }
  return rows;
}

/**
 * The logbook's entries, in the logbook's order: each "###" heading under "## Entries" is a chapter -- its cycle code
 * when it has one, its title, the status and date it closed with, the lane it names -- and its lines are the body.
 * An entry with no cycle code keeps none; nothing is invented for it (company ring).
 * @param {string | null} text @returns {History}
 */
export function historyOf(text) {
  /** @type {History} */
  const none = { isRead: false, unread: false, entries: [], newest: "", cycles: [], cyclesUnread: false, milestones: [], milestonesUnread: false };
  if (typeof text !== "string" || text.trim() === "") return none;
  const t = text.replace(/\r\n/g, "\n");
  const h2 = sections(t, 2);
  // The glance table is the cycles in the logbook's order; the milestone tracker is what the company set out to reach.
  const glanceS = sectionOf(h2, "At a glance");
  const cycles = glanceS ? tableRows(glanceS.lines).filter((c) => c.length >= 6).map((c) => ({
    code: /^C\d+$/.test(c[0] ?? "") ? (c[0] ?? "") : "", name: c[1] ?? "", dates: c[2] ?? "", result: c[3] ?? "", burn: c[4] ?? "", shipped: c[5] ?? "",
  })) : [];
  const milestoneS = sectionOf(h2, "Milestone tracker");
  const milestones = milestoneS ? tableRows(milestoneS.lines).filter((c) => c.length >= 2).map((c) => ({
    milestone: c[0] ?? "", status: c[1] ?? "", isDone: (c[1] ?? "").startsWith("✅"), isPending: (c[1] ?? "").startsWith("⏳"),
  })) : [];
  const tables = { cycles, cyclesUnread: glanceS === null, milestones, milestonesUnread: milestoneS === null };
  const entriesS = sectionOf(h2, "Entries");
  if (!entriesS) return { ...none, isRead: true, unread: true, ...tables };
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
      date: (DATE.exec(tail) || [])[1] ?? "",
      lane: LANE.test(lane) ? lane : "",
      body: body.map((b) => plain(b.replace(/^(?:[-*]|\d+\.)\s+/, ""))).filter((b) => b !== ""),
    };
  });
  const newest = entries.map((e) => e.date).filter(Boolean).sort().pop() ?? "";
  return { isRead: true, unread: false, entries, newest, ...tables };
}

/**
 * A band row's note in a line: when and how the century was claimed, and how much of it is taken -- the part a
 * person scans the map for. The whole note stays on the row; a note that is not a claim keeps its first sentence when
 * that is short, and otherwise says nothing rather than cutting a sentence in half.
 * @param {string} note @returns {string}
 */
function briefOf(note) {
  const claimed = /claimed at birth, (\d{4}-\d{2}-\d{2})/.exec(note);
  const taken = /\((\d{4}[–-]\d{4}) taken/.exec(note);
  if (claimed) return `claimed ${claimed[1]}${taken ? ` · ${taken[1]} taken` : ""}`;
  const first = (note.split(/(?<=\.)\s|;\s/)[0] ?? "").trim();
  return first.length <= 110 ? first : "";
}

/**
 * The ADR century bands, read from PORTFOLIO.md's band table -- the record of which lane owns which century -- so the
 * map names the LANE (F1, ADR-1317 decision 4). A lane is a backticked name at the start of its row; the company's
 * own band and the next unclaimed century are drawn as what they are, never as a lane. No table reads as UNREAD.
 * @param {string | null} text @returns {Bands}
 */
export function bandsOf(text) {
  if (typeof text !== "string" || text.trim() === "") return { isRead: false, unread: false, rows: [] };
  const t = text.replace(/\r\n/g, "\n");
  const s = sectionOf(sections(t, 2), "ADR number bands");
  if (!s) return { isRead: true, unread: true, rows: [] };
  /** @type {Band[]} */
  const rows = [];
  for (const line of s.lines) {
    const m = /^\|\s*(\d{4}\s*[–-]\s*\d{4})\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const band = (m[1] ?? "").replace(/\s+/g, "");
    const cell = m[2] ?? "";
    const laneM = /^`([a-z][a-z0-9-]*)`\s*(.*)$/.exec(cell);
    if (laneM && LANE.test(laneM[1] ?? "")) {
      const note = plain(laneM[2] ?? "").replace(/^[—–-]\s*/, "");
      rows.push({ band, lane: laneM[1] ?? "", isLane: true, isOpen: false, owner: laneM[1] ?? "", note, brief: briefOf(note) });
      continue;
    }
    const open = /^next lane to be born/i.test(cell.trim());
    const [owner, ...note] = plain(cell).split(" — ");
    const whole = note.join(" — ").trim();
    rows.push({ band, lane: "", isLane: false, isOpen: open, owner: (owner ?? "").trim(), note: whole, brief: briefOf(whole) });
  }
  return { isRead: true, unread: rows.length === 0, rows };
}

/**
 * The glossary, from the contract the door serves: every term with its room and station, grouped by the served
 * rooms in the registry's order, and the terms whose room is not served counted out loud as unhomed.
 * @param {string | null} text  the contract's text, already un-escaped
 * @param {readonly { id: string, name?: string }[]} rooms  the rooms the shell draws
 * @returns {Glossary}
 */
export function glossaryOf(text, rooms) {
  /** @type {Glossary} */
  const empty = { isRead: false, isRefused: false, refusal: NO_REFUSAL, terms: [], byRoom: [], unhomed: [], count: 0 };
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
  const served = new Map((Array.isArray(rooms) ? rooms : []).map((r) => [r.id, r]));
  /** @type {Term[]} */
  const terms = [];
  for (const [term, v] of Object.entries(/** @type {Record<string, unknown>} */ (map))) {
    const o = v !== null && typeof v === "object" ? /** @type {Record<string, unknown>} */ (v) : {};
    const room = typeof o["room"] === "string" ? o["room"] : "";
    const station = typeof o["station"] === "string" ? o["station"] : "";
    terms.push({ term, room, station, isHomed: room !== "" && served.has(room) });
  }
  terms.sort((a, b) => a.term.localeCompare(b.term));
  const byRoom = [...served.values()].map((r) => ({ room: r.id, name: typeof r.name === "string" && r.name !== "" ? r.name : r.id, terms: terms.filter((t) => t.room === r.id) })).filter((g) => g.terms.length > 0);
  return { isRead: true, isRefused: false, refusal: NO_REFUSAL, terms, byRoom, unhomed: terms.filter((t) => !t.isHomed), count: terms.length };
}

/**
 * One allow-listed file for a company room: planned if the manifest may read it, its provenance as the door served
 * it, and its text un-escaped ONCE -- or the reason there is none. The read joins `reads`.
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
  const source = sourceFile(id, p);
  const raw = source.isRead && p.state === "ok" && p.data !== null && typeof p.data === "object" ? /** @type {Record<string, unknown>} */ (p.data)["text"] : null;
  return { source, text: typeof raw === "string" ? unescapeDoorText(raw) : null };
}
