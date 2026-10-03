// fold.mjs -- company/org: every decision the org room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1324, ADR-1326; carried finding F1).
//
// The port of v0.7's Org onto the door. The roster is the board's lanes, each value read from the lane's own machine
// header (ADR-0051): its status, its phase, its cycle, and the one thing it waits on. The ADR band map names the LANE
// that owns each century (F1), read from PORTFOLIO.md's band table -- the record of which lane claimed which century --
// never the room the contract homes a band in, which is what Cycle 15's panel printed. What /api/lanes will fold (the
// receipts each lane fired today) is NOT SERVED; setting a lane's status and birthing a lane are work-door verbs.
import { notServed, payloadOf, readProblem, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { boardRows, boardTotals } from "../../../lib/spine.mjs";
import { bandsOf, boardLanes, fileText, laneLinks } from "../../../lib/company-room.mjs";
import { unescapeDoorText } from "../../../lib/door.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {{ isReading: boolean, isRefused: boolean, refusal: { code: string, human: string } }} board
 * @property {import("../../../ui/company").RosterView[]} roster
 * @property {{ live: number, idle: number, blocked: number, lanes: number }} counts
 * @property {{ key: string, lane: string, on: string }[]} waiting
 * @property {boolean} isWaitingEmpty
 * @property {string} waitingEmpty
 * @property {{ rows: (import("../../../ui/company").BandView & { lane: string })[], isRead: boolean, isEmpty: boolean, empty: string, notes: string[], hasNotes: boolean }} bands
 * @property {import("../../../lib/lane-room.mjs").SourceFile} portfolio
 * @property {import("../../../lib/registry.mjs").NotServed} today
 * @property {{ isVerbPending: true, verb: string, sentence: string }} birthVerb
 * @property {OrgView} org
 * @property {Read[]} reads
 */

/**
 * The roles, scorecards and teams section (org Cycle 19, ADR-1624/1625): every value as /api/org served it. The fold
 * maps and words; it never counts a receipt or re-tests a seat -- the producer's own flags decide (twin-fix retro).
 * @typedef {{ key: string, id: string, title: string, state: string, seat: string, origin: string }} RoleRow
 * @typedef {{ key: string, role: string, seat: string, isVerdict: boolean, verdict: string, why: string, due: string, line: string }} ScoreRow
 * @typedef {{ key: string, venture: string, stage: string, valid: boolean, status: string, seats: string, findings: string[] }} TeamRow
 * @typedef {object} OrgView
 * @property {boolean} isReading
 * @property {boolean} isRefused
 * @property {{ code: string, human: string }} refusal
 * @property {string} countsLine
 * @property {boolean} hasCountsLine
 * @property {number} roleCount
 * @property {{ key: string, name: string, roles: RoleRow[] }[]} departments
 * @property {{ isRefused: boolean, refusal: { code: string, human: string }, rows: ScoreRow[], others: ScoreRow[], hasOthers: boolean, footnote: string, hasFootnote: boolean }} scores
 * @property {{ isEmpty: boolean, empty: string, rows: TeamRow[] }} teams
 * @property {string[]} notes
 */

const NO_REFUSAL = Object.freeze({ code: "", human: "" });

/** The six seat classes of the chart, in the order the counts line names them; `own`/`hired` are origins, not states. */
export const STATE_CLASSES = Object.freeze([
  { key: "staffed", label: "staffed" }, { key: "partial", label: "partial" }, { key: "seated-unlegitimised", label: "seated, not yet legitimised" },
  { key: "human", label: "human" }, { key: "vacant", label: "vacant" },
]);

const isObj = (/** @type {unknown} */ v) => v !== null && typeof v === "object" && !Array.isArray(v);
// The door escapes every string it serves (escapeDeep); the room draws the text, so it is unescaped once here.
const str = (/** @type {unknown} */ v) => (typeof v === "string" ? unescapeDoorText(v) : "");
const int = (/** @type {unknown} */ v) => (Number.isInteger(v) ? /** @type {number} */ (v) : null);

/**
 * One seat's receipts in words. A seat no receipt is placed on reads `no evidence`, never 0 or a rate; cost with no
 * cost receipt is absent, not zero (org-review's own rule, ADR-1604).
 * @param {Record<string, unknown>} r
 */
export function receiptsLine(r) {
  if (r["evidence"] !== true) return "no evidence";
  const n = (/** @type {string} */ k) => fmtInt(int(r[k]) ?? 0);
  const cost = int(r["cost_minor"]);
  return `receipts ${n("receipts")} (${n("sourced")} sourced) · runs ${n("runs")} (${n("runs_ok")} ok, ${n("runs_fail")} fail) · accepts ${n("accepts")} · rejects ${n("rejects")} · incidents ${n("incidents")} · cost ${cost === null ? "no evidence" : fmtInt(cost)}`;
}

/**
 * @param {Payload} p  the /api/org payload, or a refusal the fold made itself
 * @returns {OrgView}
 */
export function foldOrg(p) {
  /** @type {OrgView["scores"]} */
  const none = { isRefused: false, refusal: { code: "", human: "" }, rows: [], others: [], hasOthers: false, footnote: "", hasFootnote: false };
  const empty = /** @type {OrgView} */ ({
    isReading: p.state === "loading" || p.state === "pending", isRefused: false, refusal: NO_REFUSAL, countsLine: "", hasCountsLine: false, roleCount: 0,
    departments: [], scores: none, teams: { isEmpty: false, empty: "", rows: [] }, notes: [],
  });
  if (p.state === "refused") return { ...empty, isRefused: true, refusal: { code: str(p.code), human: str(p.human) } };
  if (p.state !== "ok") return empty;
  const body = isObj(p.data) ? /** @type {Record<string, unknown>} */ (p.data) : {};
  const chart = isObj(body["chart"]) ? /** @type {Record<string, unknown>} */ (body["chart"]) : null;
  const depts = chart && Array.isArray(chart["departments"]) ? chart["departments"] : null;
  const counts = chart && isObj(chart["counts"]) ? /** @type {Record<string, unknown>} */ (chart["counts"]) : null;
  if (body["schema"] !== 1 || !depts || !counts) {
    return { ...empty, isRefused: true, refusal: { code: "SOURCE_INVALID", human: `the door's /api/org body is not schema 1 with a chart -- refused whole, never drawn in part (schema ${JSON.stringify(body["schema"] ?? null)})` } };
  }

  /** @type {{ key: string, name: string, roles: RoleRow[] }[]} */
  const departments = depts.filter(isObj).map((d, i) => {
    const dd = /** @type {Record<string, unknown>} */ (d);
    const roles = (Array.isArray(dd["roles"]) ? dd["roles"] : []).filter(isObj).map((r, j) => {
      const rr = /** @type {Record<string, unknown>} */ (r);
      return { key: `${i}-${j}-${str(rr["id"])}`, id: str(rr["id"]), title: str(rr["title"]), state: str(rr["state"]), seat: str(rr["seat"]), origin: str(rr["origin"]) };
    });
    return { key: `${i}-${str(dd["dept"])}`, name: str(dd["name"]) || str(dd["dept"]), roles };
  });
  const roleCount = departments.reduce((n, d) => n + d.roles.length, 0);
  const total = int(counts["roles"]);
  const classSum = STATE_CLASSES.reduce((n, c) => n + (int(counts[c.key]) ?? 0), 0);
  const countsLine = [`${fmtInt(total ?? 0)} roles`, ...STATE_CLASSES.map((c) => `${fmtInt(int(counts[c.key]) ?? 0)} ${c.label}`)].join(" · ");
  /** @type {string[]} */
  const notes = [];
  // The chart's own classes must account for every role it lists; a mismatch is shown, never smoothed over.
  if (total !== roleCount || classSum !== roleCount) notes.push(`The chart lists ${fmtInt(roleCount)} role rows, its count says ${fmtInt(total ?? 0)}, and its seat classes add up to ${fmtInt(classSum)} -- these should be one number.`);
  const scrubbed = Array.isArray(body["scrubbed"]) ? body["scrubbed"].filter((x) => typeof x === "string") : [];
  if (scrubbed.length > 0) notes.push(`The door withheld a path or an address in ${scrubbed.length === 1 ? "this role" : "these roles"}: ${scrubbed.join(", ")}.`);
  const parts = Array.isArray(body["scrubbedParts"]) ? body["scrubbedParts"].filter((x) => typeof x === "string") : [];
  if (parts.length > 0) notes.push(`The door withheld a path or an address in the ${parts.join(", ")} part${parts.length === 1 ? "" : "s"}.`);

  const sc = isObj(body["scorecards"]) ? /** @type {Record<string, unknown>} */ (body["scorecards"]) : {};
  /** @type {OrgView["scores"]} */
  let scores = none;
  if (sc["state"] !== "ok") {
    scores = { ...none, isRefused: true, refusal: { code: str(sc["code"]) || "SOURCE_INVALID", human: str(sc["human"]) || "the door served no scorecards" } };
  } else {
    const rows = (Array.isArray(sc["rows"]) ? sc["rows"] : []).filter(isObj).map((r) => /** @type {Record<string, unknown>} */ (r));
    const toRow = (/** @type {Record<string, unknown>} */ r, /** @type {number} */ i) => ({
      isVerdict: r["staffed"] === true,
      key: `${i}-${str(r["role"])}`, role: str(r["role"]), seat: str(r["seat"]),
      verdict: str(r["verdict"]).toUpperCase(), why: str(r["why"]), due: str(r["due"]), line: receiptsLine(r),
    });
    const damage = isObj(sc["spineDamage"]) ? /** @type {Record<string, unknown>} */ (sc["spineDamage"]) : {};
    const torn = int(damage["torn"]) ?? 0, unreadable = int(damage["unreadable"]) ?? 0;
    const foot = [`${fmtInt(int(sc["total"]) ?? 0)} receipts read · ${fmtInt(int(sc["unattributed"]) ?? 0)} placed on no role`];
    if ((int(sc["conflicts"]) ?? 0) > 0) foot.push(`${fmtInt(int(sc["conflicts"]) ?? 0)} where a receipt's role and the map disagree`);
    if (torn + unreadable > 0) foot.push(`spine damage: ${fmtInt(torn)} torn line(s), ${fmtInt(unreadable)} unreadable day(s), not scored`);
    const others = rows.filter((r) => r["staffed"] !== true && r["evidence"] === true).map(toRow);
    scores = {
      isRefused: false, refusal: NO_REFUSAL,
      rows: rows.filter((r) => r["staffed"] === true).map(toRow),
      others, hasOthers: others.length > 0,
      footnote: foot.join(" · "), hasFootnote: true,
    };
  }

  const tm = isObj(body["teams"]) ? /** @type {Record<string, unknown>} */ (body["teams"]) : {};
  const teamRows = (Array.isArray(tm["rows"]) ? tm["rows"] : []).filter(isObj).map((t, i) => {
    const tt = /** @type {Record<string, unknown>} */ (t);
    const seats = (Array.isArray(tt["seats"]) ? tt["seats"] : []).filter(isObj).map((s) => str(/** @type {Record<string, unknown>} */ (s)["id"])).filter(Boolean);
    const valid = tt["valid"] === true;
    const findings = (Array.isArray(tt["findings"]) ? tt["findings"] : []).map(str).filter(Boolean);
    return { key: `${i}-${str(tt["venture"])}`, venture: str(tt["venture"]), stage: str(tt["stage"]), valid, status: valid ? "checks clean" : `${fmtInt(findings.length)} finding(s)`, seats: seats.join(", "), findings };
  });
  const teams = { isEmpty: teamRows.length === 0, empty: teamRows.length === 0 ? (str(tm["why"]) || "The door served no venture team.") : "", rows: teamRows };

  return { isReading: false, isRefused: false, refusal: NO_REFUSAL, countsLine, hasCountsLine: true, roleCount, departments, scores, teams, notes };
}

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Read[]} */
  const reads = [];
  /** @type {Read} */
  const boardRead = { route: "/api/board" };
  const boardWhy = readProblem(boardRead, ctx.manifest);
  if (boardWhy === null) reads.push(boardRead);
  /** @type {Payload} */
  const boardP = boardWhy === null ? payloadOf(payloads, boardRead) : { state: "refused", code: "READ_REFUSED", human: boardWhy };
  const view = boardP.state === "ok" ? boardRows(boardP.data) : null;
  const isBoardRead = view !== null && "rows" in view;
  const board_ = boardLanes(isBoardRead ? view.rows : []);
  const rows = board_.rows;
  const linkOf = laneLinks(ctx);
  const totals = boardTotals(rows);
  const board = {
    isReading: boardP.state === "loading" || boardP.state === "pending",
    isRefused: boardP.state === "refused" || (view !== null && !("rows" in view)),
    refusal: boardP.state === "refused" ? { code: boardP.code, human: boardP.human } : view !== null && !("rows" in view) ? view : NO_REFUSAL,
  };

  const roster = rows.map((r, i) => {
    const link = linkOf(r.lane);
    return {
      key: `${i}-${r.lane}`,
      lane: r.lane,
      status: r.status.label,
      ink: r.status.ink,
      phase: r.phase.number === null ? "no phase" : `phase ${r.phase.number}`,
      cycle: r.cycle ?? "no cycle line in its header",
      // The blocked-on line is drawn once, under who is waiting on whom -- never twice on one screen.
      line: "",
      lineInk: "var(--text-2)",
      canOpen: link.canOpen,
    };
  });
  const waiting = rows.filter((r) => r.blockedOn !== null).map((r, i) => ({ key: `${i}-${r.lane}`, lane: r.lane, on: r.blockedOn ?? "" }));

  // F1: the band map names the lane that owns each century, from the portfolio's band table -- held against the
  // lanes the board carries, so a backticked word that is no lane is never drawn as one (company ring attack). Until
  // the board answers, no band's lane is confirmed and the map says so.
  const file = fileText(payloads, ctx, "portfolio", reads);
  const b = bandsOf(file.text, isBoardRead ? new Set(rows.map((r) => r.lane)) : new Set());
  const bandRows = b.rows.map((row, i) => {
    const link = row.isLane ? linkOf(row.lane) : { canOpen: false, room: "" };
    return { key: `${i}-${row.band}`, band: row.band, lane: row.lane, who: row.isLane ? row.lane : row.owner, note: row.brief, title: row.note, isLane: row.isLane, canOpen: link.canOpen, room: link.room };
  });
  const bandsRead = file.source.isRead && b.isRead && !b.unread;
  const claimed = new Set(b.rows.filter((r) => r.isLane).map((r) => r.band)).size;
  /** @type {string[]} */
  const bandNotes = [];
  if (bandsRead && !isBoardRead) bandNotes.push("The board has not answered, so no band's lane is confirmed yet.");
  if (b.malformed.length > 0) bandNotes.push(`${fmtInt(b.malformed.length)} row${b.malformed.length === 1 ? "" : "s"} of the table this reader could not read: ${b.malformed.join(" · ")}`);
  if (b.duplicates.length > 0) bandNotes.push(`Claimed on more than one row: ${b.duplicates.join(", ")}.`);
  if (isBoardRead && b.unverified.length > 0) bandNotes.push(`Named as owners and not lanes on the board: ${b.unverified.join(", ")}.`);
  if (board_.dropped > 0) bandNotes.push(`${fmtInt(board_.dropped)} board row${board_.dropped === 1 ? " carries" : "s carry"} no readable lane name or repeat${board_.dropped === 1 ? "s" : ""} one already listed -- left out and counted.`);
  // A board row whose lane resolves off the tree is named by the door and never read (Phase 04 round 3); the org chart
  // says so as the board's lanes tile does, so a shorter org is never read as a smaller company (round 4).
  const rawBoard = boardP.state === "ok" && boardP.data !== null && typeof boardP.data === "object" ? /** @type {Record<string, unknown>} */ (boardP.data) : {};
  const outsideLanes = (Array.isArray(rawBoard["outside"]) ? rawBoard["outside"] : []).filter((l) => typeof l === "string" && l !== "");

  /** @type {Read} */
  const orgRead = { route: "/api/org" };
  const orgWhy = readProblem(orgRead, ctx.manifest);
  if (orgWhy === null) reads.push(orgRead);
  const org = foldOrg(orgWhy === null ? payloadOf(payloads, orgRead) : { state: "refused", code: "READ_REFUSED", human: orgWhy });

  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: isBoardRead ? `${fmtInt(totals.lanes)} lanes${outsideLanes.length > 0 ? ` · ${fmtInt(outsideLanes.length)} off the tree, not read: ${outsideLanes.join(", ")}` : ""} · each value from the lane's own header` : "the board · not read",
    kpis: [
      { key: "live", v: isBoardRead ? fmtInt(totals.live) : "—", l: "Awake", sub: "header reads LIVE" },
      { key: "idle", v: isBoardRead ? fmtInt(totals.idle) : "—", l: "Idle", sub: "no cycle running" },
      { key: "waiting", v: isBoardRead ? fmtInt(waiting.length) : "—", l: "Waiting on something", sub: "a blocked-on line in the header" },
      { key: "bands", v: bandsRead && isBoardRead && b.malformed.length === 0 ? fmtInt(claimed) : "—", l: "ADR centuries claimed", sub: b.duplicates.length > 0 ? "a century is claimed twice -- see the map" : "one per lane, PORTFOLIO.md" },
    ],
    board,
    roster,
    counts: { live: totals.live, idle: totals.idle, blocked: totals.blocked, lanes: totals.lanes },
    waiting,
    isWaitingEmpty: waiting.length === 0,
    waitingEmpty: isBoardRead ? "No lane's header names anything it is waiting on." : "",
    bands: {
      rows: bandsRead ? bandRows : [],
      isRead: bandsRead,
      isEmpty: !bandsRead,
      empty: !file.source.isRead ? "" : "The portfolio the door served carries no ADR band table this reader can read, so no century is drawn -- and none is claimed unowned.",
      notes: bandNotes,
      hasNotes: bandNotes.length > 0,
    },
    portfolio: file.source,
    today: notServed(
      "Receipts per lane today",
      "/api/lanes",
      "Which lanes fired a receipt today, counted per lane -- so a lane whose header says IDLE and that emitted today reads awake, and one whose header says LIVE and fired nothing reads quiet. A receipt carries no lane: the spine's envelope has no lane field and only three develop kinds name one in their payload, so no count per lane can be derived -- filed to the spine lane.",
    ),
    // "Set a lane's status" is LIVE since face v2 Phase 05 (ADR-1343): the work door's org.lane-status op, drawn under
    // this room by the host. Its card is retired; birthing a lane stays /arc-kickoff's.
    birthVerb: verbPending(
      "Birth a lane",
      "Only /arc-kickoff births a lane: it claims the next ADR century and lands the lane's room in the same change. The work door will start that ceremony from here.",
    ),
    org,
    reads,
  };
}
