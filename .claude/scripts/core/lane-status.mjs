#!/usr/bin/env node
// lane-status.mjs -- set a lane's status: its PROGRESS machine header and its board row, changed together on a
// proposal branch (face v2 Phase 05 PR 5b, ADR-1343).
//
//   lane-status.mjs --lane L --status LIVE|IDLE|QUEUED|BLOCKED [--blocked-on "TARGET — REASON"] [--why TEXT]
//                   (--dry-run | --expect D)
//
// A lane's status is its PROGRESS header, and PORTFOLIO.md's row is a view of it (ADR-0051): the two change in ONE
// commit, or board-lint and portfolio-board.bats go red on main. Only /arc-kickoff births a lane, so a lane main does
// not hold is refused, never created. BLOCKED names what blocks it in ADR-0051's `<target> — <reason>`; every other
// status clears the blocker. The receipt is approval.requested (gate lane-status) for the owner's inbox.
//
//   --dry-run   the diffs against main and the digest last
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { createHash } from "node:crypto";
import { realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, openProposalsHolding, planProposal, proposalBranch, writeProposal, ProposalError } from "./proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt } from "./plan-expect.mjs";
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

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`lane-status: ${msg}\n`); process.exitCode = code; throw new Stop(); }
let written = false;

/** ADR-0051's `<target> — <reason>`: both halves words, one separator, nothing a board cell cannot hold. */
function blockerOk(v) {
  const at = v.indexOf(` ${DASH} `);
  if (at < 0 || v.indexOf(` ${DASH} `, at + 1) >= 0) return false;
  return v.slice(0, at).trim() !== "" && v.slice(at + 3).trim() !== "" && !v.includes(" / ");
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
  if (a.status === "BLOCKED") {
    const b = a["blocked-on"];
    if (b === undefined) die(2, `BLOCKED names what blocks the lane: --blocked-on "owner ${DASH} the reason"`);
    if (!isOneLine(b) || b !== b.trim() || b.includes("|") || b.includes("`") || Buffer.byteLength(b) > 200 || !blockerOk(b))
      die(2, `--blocked-on is ADR-0051's "<lane|owner|external> ${DASH} <reason>": one line, up to 200 bytes, one ${DASH} between spaces, no | and no " / "`);
    // The board is published: a machine path or an address in the reason would be the owner's, in public.
    if (scrub(b, REPO) !== b) die(2, "--blocked-on names a machine path or an address, and PORTFOLIO.md is published -- say it without one");
  } else if (a["blocked-on"] !== undefined) die(2, `--blocked-on belongs with BLOCKED; ${a.status} clears the blocker`);
  if (a.why && (!isOneLine(a.why) || Buffer.byteLength(a.why) > 300)) die(2, "--why is one line of text, up to 300 bytes, with no control or invisible characters");
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
 * The header block as board-lint reads it -- line 1 to the first `##`, fenced blocks skipped -- with status and
 * blocked-on replaced. Each of the three keys must be there exactly once: board-lint takes the LAST value, so a second
 * one would leave the edit invisible to it.
 */
export function setHeader(text, status, blockedOn) {
  const lines = text.split("\n");
  const at = { status: [], "blocked-on": [], "depends-on": [] };
  let fence = "";
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart();
    const f3 = t.slice(0, 3);
    if (f3 === "```" || f3 === "~~~") { fence = fence === "" ? f3 : fence === f3 ? "" : fence; continue; }
    if (fence !== "") continue;
    if (t.startsWith("##")) break;
    for (const k of Object.keys(at)) if (new RegExp(`^${k}[ \\t]*:`).test(t)) at[k].push(i);
  }
  if (fence !== "") die(2, "the lane's PROGRESS header has a code fence left open -- fix it first");
  for (const k of Object.keys(at)) if (at[k].length !== 1) die(2, `the lane's PROGRESS header holds ${k}: ${at[k].length} times -- it must hold it once`);
  const value = (i) => lines[i].slice(lines[i].indexOf(":") + 1).trim();
  const was = { status: value(at.status[0]), blockedOn: value(at["blocked-on"][0]), dependsOn: value(at["depends-on"][0]) };
  lines[at.status[0]] = `status: ${status}`;
  lines[at["blocked-on"][0]] = `blocked-on: ${blockedOn}`;
  return { text: lines.join("\n"), was };
}

/** The lane's board row with its status and blocked-on / depends-on cells rewritten; every other byte kept. */
export function setBoardRow(text, lane, status, col6) {
  const lines = text.split("\n");
  const heads = lines.flatMap((l, i) => (l === BOARD_HEAD ? [i] : []));
  if (heads.length !== 1 || lines[heads[0] + 1] !== BOARD_RULE) die(2, `${PORTFOLIO} on main does not hold the lane table exactly once (${BOARD_HEAD}) -- fix it first`);
  const rows = [];
  for (let i = heads[0] + 2; i < lines.length && lines[i].startsWith("|"); i++) {
    const cells = lines[i].split(/(?<!\\)\|/);
    if (cells.length > 2 && cells[1].trim() === lane) rows.push({ i, cells });
  }
  if (rows.length !== 1) die(2, `${PORTFOLIO} on main holds ${rows.length} rows for ${lane} -- a born lane has exactly one`);
  const { i, cells } = rows[0];
  if (cells.length !== 9) die(2, `${lane}'s board row does not split into its seven cells -- fix it first`);
  cells[2] = ` ${status} `;
  cells[6] = ` ${col6} `;
  lines[i] = cells.join("|");
  return lines.join("\n");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const blockedOn = a.status === "BLOCKED" ? a["blocked-on"] : DASH;
  const progressPath = `initiatives/${a.lane}/PROGRESS.md`;
  const branch = proposalBranch("lane-status", `${a.lane}-${a.status.toLowerCase()}`);
  const [progress, portfolio] = await Promise.all([mainText(progressPath), mainText(PORTFOLIO)]);
  if (progress.text === null) die(2, `${a.lane} is not a lane on main (no ${progressPath}) -- only /arc-kickoff births a lane`);
  if (portfolio.text === null) die(2, `${PORTFOLIO} is not on main`);
  const base = progress.base;
  if (portfolio.base !== base) die(2, "main moved while its files were read -- run it again");

  const h = setHeader(progress.text, a.status, blockedOn);
  if (h.was.status === a.status && h.was.blockedOn === blockedOn) die(2, `${a.lane} is already ${a.status}${a.status === "BLOCKED" ? ` on that blocker` : ""} on main -- nothing to change`);
  const col6 = blockedOn === DASH && h.was.dependsOn === DASH ? DASH : `${blockedOn} / ${h.was.dependsOn}`;
  const board = setBoardRow(portfolio.text, a.lane, a.status, col6);

  // ONE OPEN PROPOSAL of a lane's status: two, merged in either order, leave the lane in whichever landed last, and
  // the owner approved them as two separate states.
  const open = await openProposalsHolding({ repo: REPO, prefix: "feat/face-lane-status-", path: progressPath });
  if (open.length) die(2, `a proposal of ${a.lane}'s status is already open (${open.join(", ")}) -- merge or delete it first`);
  const files = [{ path: progressPath, content: h.text }, { path: PORTFOLIO, content: board }];
  const allow = files.map((f) => f.path);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) die(2, "main moved while the status was set -- run it again");

  const what = `lane ${a.lane}: ${h.was.status} -> ${a.status}${a.status === "BLOCKED" ? ` (blocked on ${blockedOn})` : ""} (branch ${branch})`;
  if (Buffer.byteLength(what) > 512) die(2, "the request's sentence is past 512 bytes -- shorten the blocker");
  const approval = { what, gate: "lane-status", lane: a.lane, status: a.status, blocked_on: blockedOn, branch };
  // One change of one lane off one main is one question; the emitter refuses the second.
  const idem = createHash("sha256").update(`lane.status|${a.lane}|${a.status}|${blockedOn}|${base}`).digest("hex");
  const emitFlags = ["--idem", idem, "--strict"];
  // ONE spine for the read and the emit, handed to the emitter as an absolute path.
  let root;
  try { root = spineRoot(); } catch (e) { die(2, `the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  const spineEnv = { ...process.env, ARC_SPINE_ROOT: root };
  const read = await query(root, { kind: "approval.requested", engine: "scan" });
  if ((read.unreadable && read.unreadable.length) || (read.torn && read.torn.length)) die(2, "the spine has a day it cannot read or a torn line, so an earlier request cannot be ruled out -- nothing was written");
  const already = read.events.map((r) => r.event).find((e) => e && e.idem === idem);
  if (already) die(2, `this change of ${a.lane} is already requested on the spine (${already.id}) -- decide that one; nothing was written`);
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags });
  if (refused) die(2, `the request this raises would be refused by the spine, so nothing is written: ${refused}`);

  const message = `${a.lane}: status ${h.was.status} -> ${a.status} (a proposal, ADR-0051)\n\n${a.why ? `${a.why}\n\n` : ""}The lane's PROGRESS header and its PORTFOLIO.md row, in one commit, so board-lint and the board suite stay green when this merges.\nWritten by the face's work door (ADR-1343).`;
  const planned = planDigest({ branch, base, files, message, approval, idem });
  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    say(`lane-status: would set ${a.lane} ${h.was.status} -> ${a.status}${a.status === "BLOCKED" ? `, blocked on ${blockedOn}` : ""}`);
    say(`lane-status: ${files.length} files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested[lane-status]`);
    say(plan.diff.replace(/\n$/, ""));
    say("lane-status: dry run -- no branch, no object, no receipt was written");
    say(expectLine(planned));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(a.expect, planned);
  if (stale) die(2, stale);
  const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
    beforeRef: () => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags }); if (no) die(2, `the spine would refuse the request, so no branch was written: ${no}`); } });
  written = true;
  say(`lane-status: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
  const got = emitReceipt(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags, timeoutMs: 60_000 });
  if (got.state === "refused") die(1, `the branch ${branch} IS written, and its request was not raised -- ${got.why}`);
  if (got.state === "unknown") die(1, `the branch ${branch} IS written, and whether its request landed is unknown -- ${got.why}. Look in your inbox before applying again`);
  if (!got.id) die(1, `the branch ${branch} IS written, and its request landed without its id -- ${got.why}`);
  say(`receipt: approval.requested ${got.id}`);
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { process.stderr.write(`lane-status: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `lane-status: the branch IS written, and then this failed: ${why}\n` : `lane-status: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set.
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
