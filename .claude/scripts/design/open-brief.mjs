#!/usr/bin/env node
// open-brief.mjs -- open a design explore from a brief, on a proposal branch (face v2 Phase 05 factory ring,
// ADR-1341 §2).
//
//   open-brief.mjs --id <explore-id> --brief <repo path> [--why TEXT] [--dry-run | --expect D]
//
// "One surface goes out to three explores, each with a thesis it must differ by, before anything is judged." The
// scaffold is design-explore.sh init's, run into a scratch directory (--out-dir) against main's revision (--base), and
// committed to a NEW branch feat/face-design-explore-<id> through the one proposal writer: no checkout, the owner's
// tree untouched. The director and the composers work on that branch; the pick decides it. Then approval.requested
// (gate design-explore) names the branch.
//
//   --dry-run   the scaffold as a diff against main, the approval judged by the spine, and as its LAST line the digest of
//               everything an apply writes
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//   (neither)   refused: an apply is bound to a plan
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, planProposal, proposalBranch, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const EXPLORE = join(HERE, "design-explore.sh");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
// design-explore.sh's own id grammar, and a brief path of plain segments under docs/.
const ID_RE = /^[abcdefghijklmnopqrstuvwxyz0123456789][abcdefghijklmnopqrstuvwxyz0123456789-]{0,62}$/;
const BRIEF_RE = /^docs\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\.(md|html)$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`open-brief: ${msg}\n`); process.exitCode = code; throw new Stop(); }
// Set once the branch is written: a failure after that is exit 1, never a refusal.
let written = false;

function parseArgs(argv) {
  const a = { id: "", brief: "", why: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!["--id", "--brief", "--why", "--expect"].includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: --id --brief --why --expect --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!ID_RE.test(a.id)) die(2, `--id ${JSON.stringify(a.id)} is an explore id (lowercase kebab, it becomes a directory)`);
  if (!BRIEF_RE.test(a.brief) || a.brief.split("/").some((s) => s === "." || s === ".." || s.endsWith("."))) die(2, `--brief ${JSON.stringify(a.brief)} is a .md or .html path under docs/, in plain segments`);
  if (a.why && !isOneLine(a.why)) die(2, "--why is one line of text, with no control or invisible characters");
  return a;
}

/** Every regular file the scaffold wrote, as repo paths under docs/design/explore/<id>/ with their text. */
function scaffoldFiles(dir, id) {
  const files = [];
  const walk = (d, rel) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      const r = rel ? `${rel}/${n}` : n;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, r);
      else if (st.isFile()) files.push({ path: `docs/design/explore/${id}/${r}`, content: readFileSync(p, "utf8") });
    }
  };
  walk(dir, "");
  return files;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const branch = proposalBranch("design-explore", a.id);
  // The brief is read from MAIN: the branch is based on main, and an explore whose brief is not there is an explore of
  // a file the branch does not have.
  const brief = await baseText({ repo: REPO, path: a.brief });
  if (brief.text === null) die(2, `${a.brief} is not on main -- the explore's branch is based on main, so its brief must be there`);
  let scratch;
  try { scratch = mkdtempSync(join(tmpdir(), "arc-open-brief-")); }
  catch (e) { die(2, `no temp directory could be made (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  try {
    const dest = join(scratch, "explore");
    const s = spawnSync("bash", [EXPLORE, "init", a.id, "--brief", a.brief, "--out-dir", dest, "--base", brief.base.slice(0, 12)],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000, windowsHide: true });
    if (s.status !== 0) die(2, String(s.stderr || "").trim().replace(/^design-explore: /, "") || `the scaffold exited ${s.status}`);
    const files = scaffoldFiles(dest, a.id);
    if (files.length === 0) die(2, "the scaffold wrote nothing -- nothing to propose");
    const allow = files.map((f) => f.path);
    const { base } = await checkProposal({ repo: REPO, branch, paths: allow, allow });
    if (base !== brief.base) die(2, "main moved while the scaffold was made -- run it again");
    const what = `open the design explore ${a.id} from ${a.brief}`;
    const approval = (commit) => ({ what, gate: "design-explore", explore: a.id, brief: a.brief, branch, base, commit, ...(a.why ? { why: a.why } : {}) });
    const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)), { cwd: REPO });
    if (refused) die(2, `the approval this explore raises would be refused by the spine, so nothing is written: ${refused}`);
    const message = `design: ${what}\n\n${a.why ? `${a.why}\n\n` : ""}The director assigns theses and writes matrix.md; the composers fill variant-{a,b,c} on this branch, and the pick decides it.\nWritten by the face's work door (ADR-1341).`;
    // The digest covers everything the apply writes: the branch, its base, every scaffold file, the message, the approval.
    const digest = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)) });
    if (a.dryRun) {
      const plan = await planProposal({ repo: REPO, branch, files, allow, base });
      say(`open-brief: would ${what}`);
      say(`open-brief: ${files.length} scaffold file(s) on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested to your inbox`);
      say(plan.diff.replace(/\n$/, ""));
      say("open-brief: dry run -- no branch, no object, no receipt was written");
      say(expectLine(digest));
      return;
    }
    if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
    const stale = staleReason(a.expect, digest);
    if (stale) die(2, stale);
    // The REAL approval, its commit included, is judged before the branch exists (writeProposal beforeRef; PR 3b attacks).
    const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
      beforeRef: (commit) => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval(commit), { cwd: REPO }); if (no) die(2, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
    written = true;
    say(`open-brief: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
    const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(approval(w.commit)), "--strict"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const id = String(r.stdout || "").trim();
    if (r.status !== 0 || !ULID_RE.test(id))
      die(1, `the branch ${branch} IS written, and its approval was not raised -- ${String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `the emitter exited ${r.status}`}`);
    say(`receipt: approval.requested ${id}`);
  } finally {
    // Litter, never the outcome.
    try { rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* litter */ }
  }
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { process.stderr.write(`open-brief: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `open-brief: the branch IS written, and then this failed: ${why}\n` : `open-brief: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set (PR 3b, arc-event twin).
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
