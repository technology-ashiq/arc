#!/usr/bin/env node
// lane-status.mjs -- set a lane's status: its PROGRESS machine header and its board row, changed together on a
// proposal branch (face v2 Phase 05 PR 5b, ADR-1343).
//
//   lane-status.mjs --lane L --status LIVE|IDLE|QUEUED|BLOCKED [--blocked-on "TARGET — REASON"] [--why TEXT]
//                   (--dry-run | --expect D)
//
// A lane's status is its PROGRESS header, and PORTFOLIO.md's row is a view of it (ADR-0051): the two change in ONE
// commit, or board-lint and portfolio-board.bats go red on main. Only /arc-kickoff births a lane, so a lane main does
// not hold is refused, never created. A blocker is ADR-0051's `<target> — <reason>`: BLOCKED needs one, any status may
// set one, "—" clears it, and none given keeps main's. The receipt is approval.requested (gate lane-status) for the
// owner's inbox.
//
//   --dry-run   the diffs against main and the digest last
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { createHash } from "node:crypto";
import { existsSync, realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, openProposalsChanging, planProposal, proposalBranch, proposalLocks, writeProposal, ProposalError } from "./proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt, withExclusiveLock } from "./plan-expect.mjs";
import { isOneLine } from "./one-line.mjs";
import { query, spineRoot } from "../hq/spine.mjs";
import { scrub } from "../hq/lib/face/reads.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const PORTFOLIO = "PORTFOLIO.md";
const STATUSES = Object.freeze(["LIVE", "IDLE", "QUEUED", "BLOCKED"]);
// ADR-0051's empty marker and separator: U+2014, compared by bytes (board-lint does the same).
const DASH = "—";
const LANE_RE = /^[a-z][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const BOARD_HEAD = "| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |";
const BOARD_RULE = "|---|---|---|---|---|---|---|";
// ALLOW-LISTED, because the board is published: a scrub-only test let "E:Work_Hub\...", "C://Users/..." and "..\..\x"
// into PORTFOLIO.md, and the markdown of a tracking image with them (PR 5b round-1 shell attack; the venture-register
// twin of PR 5a round 2). Plain ASCII words -- no slash, backslash, colon, @, markup or invisible character.
const WORDS = /^[A-Za-z0-9][A-Za-z0-9 ,.()'#%+&-]*$/;
// ADR-0051's `<lane|owner|external> — <reason>`: the target a lane name, owner or external, the reason plain words.
const BLOCKER = new RegExp(`^(owner|external|[a-z][a-z0-9-]{0,63}) ${DASH} (.+)$`);

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
// SYNCHRONOUS, and a closed stderr is not a crash: its EPIPE turned "refused, nothing written" into exit 1, "the branch
// IS written" (PR 5b round-1 shell attack; the ingest twin was stdout).
const err = (s) => { try { writeSync(2, s); } catch { /* the words are lost; the exit code is not */ } };
function die(code, msg) { err(`lane-status: ${msg}\n`); process.exitCode = code; throw new Stop(); }
let written = false;

/** ADR-0051's `<target> — <reason>`, allow-listed: one separator, a target that names someone, a reason in words. */
function blockerOk(v) {
  const m = BLOCKER.exec(v);
  return !!m && WORDS.test(m[2]) && m[2] === m[2].trim();
}

function parseArgs(argv) {
  const a = { lane: "", status: "", "blocked-on": undefined, why: "", expect: undefined, dryRun: false };
  const known = ["--lane", "--status", "--blocked-on", "--why", "--expect"];
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!known.includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: ${known.join(" ")} --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!LANE_RE.test(a.lane) || RESERVED.test(a.lane)) die(2, `--lane ${JSON.stringify(a.lane)} is not a lane name (lowercase kebab, up to 64 characters)`);
  if (!STATUSES.includes(a.status)) die(2, `--status is one of ${STATUSES.join(", ")}`);
  // A blocker is its own fact: a LIVE lane may carry one (growth and scheduler do on main), so any status takes
  // --blocked-on, "—" clears it, and none keeps what main holds -- a non-BLOCKED status wiped it, under a request that
  // named only the status (PR 5b round-1 logic attack).
  const b = a["blocked-on"];
  if (a.status === "BLOCKED" && b === DASH) die(2, "BLOCKED names what blocks the lane -- it cannot clear the blocker");
  if (b !== undefined && b !== DASH) {
    if (!isOneLine(b) || b !== b.trim() || Buffer.byteLength(b) > 200 || !blockerOk(b))
      die(2, `--blocked-on is ADR-0051's "<lane|owner|external> ${DASH} <reason>": up to 200 bytes, the reason in plain words (letters, digits, spaces and , . ( ) ' # % + & -)`);
    // The board is published: a machine path or an address in the reason would be the owner's, in public.
    if (scrub(b, REPO) !== b) die(2, "--blocked-on names a machine path or an address, and PORTFOLIO.md is published -- say it without one");
  }
  // The why goes into the commit message, which the plan shows and a merge publishes: plain words, as the blocker.
  if (a.why && (!WORDS.test(a.why) || a.why !== a.why.trim() || Buffer.byteLength(a.why) > 300 || scrub(a.why, REPO) !== a.why))
    die(2, "--why is plain words (letters, digits, spaces and , . ( ) ' # % + & -), up to 300 bytes");
  return a;
}

/** Main's text of one file, or null when main does not hold it. */
async function mainText(path) {
  const r = await baseText({ repo: REPO, path });
  if (r.text !== null && (r.text.startsWith(String.fromCharCode(0xfeff)) || r.text.includes("\r") || !r.text.endsWith("\n")))
    die(2, `${path} on main is not plain LF lines with a final newline -- fix it first`);
  return r;
}

/**
 * The header block with status and blocked-on replaced -- refused unless the TWO readers of it agree on every line the
 * edit depends on. board-lint skips fenced blocks and stops at the first `##`; the CI gate (`_arc_lane_header`,
 * portfolio-board.bats) skips no fence, matches a key only at the start of a line, ignores case and `*`, and takes the
 * LAST value. A fenced `status:`, a `**Status:**` twin, or a heading behind a no-break space each left the edit visible
 * to one reader and not the other, and the status the owner approved never took (PR 5b round-1 logic attack). So: no
 * fence before the first `##`, no heading behind a space either reader might not strip, and each key exactly once,
 * written as both read it.
 */
/** @param {string} text @param {string} status @param {string | undefined} blockedOn undefined keeps main's */
export function setHeader(text, status, blockedOn) {
  const lines = text.split("\n");
  const at = { status: [], "blocked-on": [], "depends-on": [] };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/\r$/, "");
    if (/^[ \t]*##/.test(l)) break;
    if (/^\s*##/.test(l)) die(2, "the lane's PROGRESS header has a heading behind a space the readers do not agree on -- fix it first");
    const f3 = l.replace(/^[ \t]+/, "").slice(0, 3);
    if (f3 === "```" || f3 === "~~~") die(2, "the lane's PROGRESS header holds a code fence -- board-lint skips it and the CI gate does not; move it below the first ## heading");
    // The loosest reading either reader could make of a key line counts it; the edit then writes the strictest form.
    const plain = l.replace(/\*/g, "").replace(/^\s+/, "").toLowerCase();
    for (const k of Object.keys(at)) if (new RegExp(`^${k}[ \\t]*:`).test(plain)) at[k].push(i);
  }
  for (const k of Object.keys(at)) if (at[k].length !== 1) die(2, `the lane's PROGRESS header holds ${k}: ${at[k].length} times -- it must hold it once`);
  for (const k of Object.keys(at)) if (!lines[at[k][0]].replace(/\*/g, "").toLowerCase().startsWith(`${k}:`)) die(2, `the lane's PROGRESS header writes ${k} in a form only one reader takes -- write it as "${k}: <value>" first`);
  const value = (i) => { const l = lines[i]; return l.slice(l.indexOf(":") + 1).replace(/[*`]/g, "").trim(); };
  const was = { status: value(at.status[0]), blockedOn: value(at["blocked-on"][0]), dependsOn: value(at["depends-on"][0]) };
  // depends-on is copied into the board's column 6 as it stands: a pipe there would add a column to the row.
  if (was.dependsOn.includes("|")) die(2, "the lane's depends-on holds a | -- a board cell cannot; fix the header first");
  const next = blockedOn === undefined ? was.blockedOn : blockedOn;
  lines[at.status[0]] = `status: ${status}`;
  lines[at["blocked-on"][0]] = `blocked-on: ${next}`;
  return { text: lines.join("\n"), was, blockedOn: next };
}

/**
 * The lane's board row with its status and blocked-on / depends-on cells rewritten; every other byte kept. The table is
 * found as board-lint finds it -- outside any fence and any HTML comment, and once in the whole file (the passport rule
 * of PR 5a round 2) -- and a row carrying a backslash is refused: board-lint splits a pipe by whether an EVEN number of
 * backslashes precedes it, so on `\\|` the two readers count different columns and a write lands in the wrong one
 * (PR 5b round-2 logic attack).
 */
export function setBoardRow(text, lane, status, col6) {
  const lines = text.split("\n");
  const heads = [];
  let fence = "";
  let comment = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.replace(/^[ \t]+/, "");
    const f3 = t.slice(0, 3);
    if (!comment && (f3 === "```" || f3 === "~~~")) { fence = fence === "" ? f3 : fence === f3 ? "" : fence; continue; }
    if (fence === "") {
      // One line may open and close a comment; a line that only opens one hides every line after it from board-lint.
      const opens = (l.match(/<!--/g) || []).length;
      const closes = (l.match(/-->/g) || []).length;
      if (!comment && opens > closes) comment = true;
      else if (comment && closes >= opens && closes > 0) { comment = false; continue; }
    }
    if (fence === "" && !comment && l === BOARD_HEAD) heads.push(i);
  }
  if (fence !== "" || comment) die(2, `${PORTFOLIO} on main leaves a code fence or an HTML comment open -- where its tables are cannot be told; close it first`);
  const anywhere = lines.filter((l) => l === BOARD_HEAD).length;
  if (heads.length !== 1 || anywhere !== 1 || lines[heads[0] + 1] !== BOARD_RULE) die(2, `${PORTFOLIO} on main does not hold the lane table exactly once, outside every fence and comment (${BOARD_HEAD}) -- fix it first`);
  const rows = [];
  for (let i = heads[0] + 2; i < lines.length && lines[i].startsWith("|"); i++) {
    if (lines[i].includes("\\")) die(2, `a row of ${PORTFOLIO}'s lane table holds a backslash, and its readers then count different columns -- take it out first`);
    const cells = lines[i].split("|");
    if (cells.length > 2 && cells[1].trim() === lane) rows.push({ i, cells });
  }
  if (rows.length !== 1) die(2, `${PORTFOLIO} on main holds ${rows.length} rows for ${lane} -- a born lane has exactly one`);
  const { i, cells } = rows[0];
  // A row may end without its closing pipe -- valid table markdown, and the bench row does -- so seven cells either way.
  const closed = lines[i].trimEnd().endsWith("|");
  if (cells.length !== (closed ? 9 : 8)) die(2, `${lane}'s board row does not split into its seven cells -- fix it first`);
  cells[2] = ` ${status} `;
  cells[6] = ` ${col6} `;
  lines[i] = cells.join("|");
  return lines.join("\n");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  // THE TOOL'S OWN REPO, for the spine as for main: run from another repository's folder, the branch landed here and the
  // request in that folder's spine (PR 5b round-1 shell attack). A relative ARC_SPINE_ROOT still means the caller's.
  if (process.env.ARC_SPINE_ROOT) process.env.ARC_SPINE_ROOT = resolve(process.env.ARC_SPINE_ROOT);
  process.chdir(REPO);
  const progressPath = `initiatives/${a.lane}/PROGRESS.md`;
  const branch = proposalBranch("lane-status", `${a.lane}-${a.status.toLowerCase()}`);
  const [progress, portfolio] = await Promise.all([mainText(progressPath), mainText(PORTFOLIO)]);
  if (progress.text === null) die(2, `${a.lane} is not a lane on main (no ${progressPath}) -- only /arc-kickoff births a lane`);
  if (portfolio.text === null) die(2, `${PORTFOLIO} is not on main`);
  const base = progress.base;
  if (portfolio.base !== base) die(2, "main moved while its files were read -- run it again");

  const h = setHeader(progress.text, a.status, a["blocked-on"]);
  const blockedOn = h.blockedOn;
  if (a.status === "BLOCKED" && blockedOn === DASH) die(2, `BLOCKED names what blocks the lane, and ${a.lane} carries no blocker on main: --blocked-on "owner ${DASH} the reason"`);
  if (h.was.status === a.status && h.was.blockedOn === blockedOn) die(2, `${a.lane} is already ${a.status} with that blocker on main -- nothing to change`);
  // The request names EVERYTHING the branch changes: the status, and the blocker when it moves.
  const change = `${h.was.status} -> ${a.status}${h.was.blockedOn !== blockedOn ? `; blocked-on ${h.was.blockedOn} -> ${blockedOn}` : ""}`;
  // A KEPT value is published as it stands: main's blocker and its depends-on go into the board cell, so a cell the
  // board cannot hold is refused by name rather than written (PR 5b round-2 logic attack). The allow-list governs what
  // this tool ADDS; what the owner already wrote is held to what board-lint can read.
  for (const [what, v] of [["blocked-on", blockedOn], ["depends-on", h.was.dependsOn]])
    if (!isOneLine(v) || v.includes("|") || v.includes(" / ") || Buffer.byteLength(v) > 400)
      die(2, `the lane's ${what} cannot go into a board cell as it stands (one line, no |, no " / ", up to 400 bytes) -- fix the header first`);
  const col6 = blockedOn === DASH && h.was.dependsOn === DASH ? DASH : `${blockedOn} / ${h.was.dependsOn}`;
  const board = setBoardRow(portfolio.text, a.lane, a.status, col6);

  // ONE OPEN PROPOSAL of a lane's status: two, merged in either order, leave the lane in whichever landed last, and the
  // owner approved them as two separate states. Judged per lane, by what a branch CHANGED and main does not hold yet --
  // "holds the file" is true of every branch, so one lane's proposal refused every lane's, and a merged one forever.
  // BOTH FILES the branch rewrites, so "one open proposal" covers the one the whole company shares: two lanes' status
  // branches merged in order conflicted in PORTFOLIO.md, because their rows are adjacent lines -- and the plan promises
  // a green merge (PR 5b round-2 shell attack). The board is a company organ; its proposals are one queue.
  const openOf = async () => {
    const seen = new Set();
    for (const path of [progressPath, PORTFOLIO]) for (const b of await openProposalsChanging({ repo: REPO, prefix: "feat/face-lane-status-", path })) seen.add(b);
    return [...seen].sort();
  };
  const open = await openOf();
  if (open.length) die(2, `a status proposal is already open (${open.join(", ")}), and it holds the board this one would rewrite -- merge or delete it first`);
  const files = [{ path: progressPath, content: h.text }, { path: PORTFOLIO, content: board }];
  const allow = files.map((f) => f.path);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) die(2, "main moved while the status was set -- run it again");

  const what = `lane ${a.lane}: ${change} (branch ${branch})`;
  if (Buffer.byteLength(what) > 512) die(2, "the request's sentence is past 512 bytes -- shorten the blocker");
  const approval = { what, gate: "lane-status", lane: a.lane, status: a.status, blocked_on: blockedOn, branch };
  // One change of one lane off one main is one question; the emitter refuses the second.
  const idem = createHash("sha256").update(`lane.status|${a.lane}|${a.status}|${blockedOn}|${base}`).digest("hex");
  const emitFlags = ["--idem", idem, "--strict"];
  // ONE spine for the read, the lock and the emit, handed to the emitter as an absolute path -- and one that exists: a
  // missing one was created by the emit, after a duplicate check that had nothing to read.
  let root;
  try { root = spineRoot(); } catch (e) { die(2, `the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  if (!existsSync(join(root, "events"))) die(2, "the spine has no events folder -- point ARC_SPINE_ROOT at a spine; nothing was written");
  const spineEnv = { ...process.env, ARC_SPINE_ROOT: root };
  // The spine says what is open as the OWNER sees it: an undecided request for this lane is the question they are
  // holding, whatever its branch now looks like (a deleted branch left the idem as the only guard, and main moving made
  // that a second question -- PR 5b round-2 logic attack).
  const requested = async () => {
    const read = await query(root, { engine: "scan" });
    if ((read.unreadable && read.unreadable.length) || (read.torn && read.torn.length)) die(2, "the spine has a day it cannot read or a torn line, so an earlier request cannot be ruled out -- nothing was written");
    const evs = read.events.map((r) => r.event);
    const already = evs.find((e) => e && e.idem === idem);
    if (already) die(2, `this change of ${a.lane} is already requested on the spine (${already.id}) -- decide that one; nothing was written`);
    const decided = new Set(evs.filter((e) => e && e.kind === "decision.recorded" && e.payload && typeof e.payload.decides === "string").map((e) => e.payload.decides));
    const open = evs.find((e) => e && e.kind === "approval.requested" && e.payload && e.payload.gate === "lane-status" && e.payload.lane === a.lane && !decided.has(e.id));
    if (open) die(2, `a status of ${a.lane} is already in your inbox undecided (${open.id}) -- decide that one; nothing was written`);
  };
  await requested();
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags });
  if (refused) die(2, `the request this raises would be refused by the spine, so nothing is written: ${refused}`);

  const message = `${a.lane}: status ${change} (a proposal, ADR-0051)\n\n${a.why ? `${a.why}\n\n` : ""}The lane's PROGRESS header and its PORTFOLIO.md row, in one commit, so board-lint and the board suite stay green when this merges.\nWritten by the face's work door (ADR-1343).`;
  const planned = planDigest({ branch, base, files, message, approval, idem });
  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    say(`lane-status: would set ${a.lane} ${change}`);
    say(`lane-status: ${files.length} files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested[lane-status]`);
    // The commit message is part of what merges: the plan shows it (the PR 4 round-3 rule).
    say("lane-status: the commit message:");
    for (const l of message.split("\n")) say(`  | ${l}`);
    say(plan.diff.replace(/\n$/, ""));
    say("lane-status: dry run -- no branch, no object, no receipt was written");
    say(expectLine(planned));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(a.expect, planned);
  if (stale) die(2, stale);
  // ONE WRITER AT A TIME, the open check again inside: two applies of two statuses, checked then written side by side,
  // both passed and wrote two branches and two requests for one lane (PR 5b round-1 shell attack).
  // The lock lives with the BRANCHES it protects, in the shared git directory: one under the caller's spine root let two
  // applies with two spine roots both write (PR 5b round-2 shell attack).
  let locks;
  try { locks = await proposalLocks({ repo: REPO }); } catch (e) { die(2, `the lock directory cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  const held = await withExclusiveLock(locks, "lane-status.lock", async () => {
    const again = await openOf();
    if (again.length) die(2, `a status proposal was opened while this one was planned (${again.join(", ")}) -- nothing was written`);
    await requested();
    const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
      beforeRef: () => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags }); if (no) die(2, `the spine would refuse the request, so no branch was written: ${no}`); } });
    written = true;
    say(`lane-status: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
    const got = emitReceipt(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags, timeoutMs: 60_000 });
    if (got.state === "refused") die(1, `the branch ${branch} IS written, and its request was not raised -- ${got.why}`);
    if (got.state === "unknown") die(1, `the branch ${branch} IS written, and whether its request landed is unknown -- ${got.why}. Look in your inbox before applying again`);
    if (!got.id) die(1, `the branch ${branch} IS written, and its request landed without its id -- ${got.why}`);
    say(`receipt: approval.requested ${got.id}`);
  });
  if (held.busy) die(2, "another lane's status is being written right now -- nothing was written; plan again when it is done");
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { err(`lane-status: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      err(written ? `lane-status: the branch IS written, and then this failed: ${why}\n` : `lane-status: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set.
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
