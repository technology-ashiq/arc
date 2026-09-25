#!/usr/bin/env node
// rule-propose.mjs -- the memory lane's rule proposals (face v2 Phase 06 slice 04, the "Promote a rule" session verb).
//
//   rule-propose.mjs --home FILE --text-file PATH [--why TEXT] [--as-process NAME@VER] [--dry-run | --expect D]
//
// /arc-retro step 2 gives a recurring finding its permanent home -- a line in CLAUDE.md, or in an area's
// .claude/rules/*.md -- and step 6 says: show it as a diff, and apply only what the owner approves. This is that step
// for one rule, without a person at the keyboard. It never writes the home file. It appends the rule's text to main's
// copy of it, and then, exactly as engine/propose.mjs does for the router:
//
//   --dry-run   prints the diff against main and writes nothing -- no object, no ref, no receipt. Its LAST line is
//               {"expect":"<digest>"}: the digest of the branch, the base, the bytes, the message and the approval
//   --expect D  commits that change to a NEW branch feat/face-memory-rule-<home>-<hash> by git plumbing
//               (core/proposal-branch.mjs: no checkout, the owner's tree untouched) -- only if what it would write is
//               still D and main has not moved -- then raises approval.requested naming the branch, and prints
//               `receipt: approval.requested <ULID>`. A human merges it, or does not.
//   (neither)   refused: an apply is bound to a plan
//
// --home is CLAUDE.md or a .claude/rules/*.md that main already carries: a rule gets an existing home, never a new
// file. --text-file is where the rule's text was written (under .claude/state/, which is gitignored): a path carries no
// shell interpolation, and the text reaches this tool as the bytes that were written. The text is scanned with the
// spine's secret rules before anything else, because it lands on a branch of a public repo.
//
// --as-process tags the receipt with the arc-run process that asked for it (`rule-promote@1.0.0`), which is how arc-run
// knows the receipt a headless run returns is that run's own. A hand run leaves it off.
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so, never retried silently) · 2 refused, nothing
// written.

import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planProposal, proposalBranch, writeProposal, baseText, mainDirNames, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";
import { scanSecrets, sizeScaledCap } from "../hq/lib/redact.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const RULES_DIR = ".claude/rules";
const SCRATCH = [".claude", "state", "rule-promote"];
const TEXT_CAP = 4096;
const LINES_CAP = 40;
const PROCESS_RE = /^[a-z][a-z0-9-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;

function die(code, msg) { process.stderr.write(`rule-propose: ${msg}\n`); process.exitCode = code; throw new Stop(); }
class Stop extends Error {}

// Set once writeProposal has returned: from then on a failure is "the branch IS written", never "refused".
let written = false;
// The branch an apply is about to write: if anything throws after writeProposal moved the ref and before it returned,
// the exit is decided by looking at what exists, never by the flag above alone (attack 3e97a85 B4).
let pendingBranch = "";

function parseArgs(argv) {
  const out = { home: "", textFile: "", why: "", asProcess: "", expect: undefined, dryRun: false };
  const seen = new Set();
  const known = ["--home", "--text-file", "--why", "--as-process", "--expect"];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { if (out.dryRun) die(2, "--dry-run given twice"); out.dryRun = true; continue; }
    if (a.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${JSON.stringify(a)}`);
    if (!known.includes(a)) die(2, `unknown argument ${JSON.stringify(a).slice(0, 80)} -- known: ${known.join(" ")} --dry-run`);
    if (seen.has(a)) die(2, `${a} given twice; pick one`);
    seen.add(a);
    const v = argv[i + 1];
    if (typeof v !== "string" || v === "" || v.startsWith("--")) die(2, `${a} needs a value`);
    i += 1;
    if (a === "--home") out.home = v;
    else if (a === "--text-file") out.textFile = v;
    else if (a === "--why") out.why = v;
    else if (a === "--as-process") out.asProcess = v;
    else out.expect = v;
  }
  if (!out.home || !out.textFile) die(2, "usage: rule-propose.mjs --home FILE --text-file PATH [--why TEXT] [--as-process NAME@VER] [--dry-run | --expect D]");
  if (out.dryRun && out.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (out.why && (!isOneLine(out.why) || out.why.length > 300)) die(2, "--why is one line of at most 300 characters");
  if (out.asProcess && !PROCESS_RE.test(out.asProcess)) die(2, "--as-process is <process>@<major.minor.patch>");
  return out;
}

/**
 * The rule's text: a plain file directly in .claude/state/rule-promote/ -- the one scratch file the session verb may
 * write, and nothing else under .claude/state (attack 3e97a85 B3) -- read through its descriptor with a cap, strict
 * UTF-8, no control characters but newlines, scanned for secrets.
 */
function readRuleText(path) {
  // A drive-absolute, UNC or device path is refused before anything resolves it: path.relative across two drives
  // returns the target itself, which no `..` check sees (attack 3e97a85 B1).
  if (isAbsolute(path) || /^[\\/]{2}/.test(path) || /^[A-Za-z]:/.test(path)) die(2, "--text-file is a path inside the repo, not an absolute, drive or UNC path");
  let dir, real;
  try { dir = realpathSync.native(join(REPO, ...SCRATCH)); } catch { die(2, "this clone has no .claude/state/rule-promote directory -- write the rule there first"); }
  try { real = realpathSync.native(resolve(REPO, path)); } catch (e) { die(2, `--text-file cannot be resolved (${e.code || "error"})`); }
  const rel = relative(dir, real);
  if (!rel || isAbsolute(rel) || rel.startsWith("..") || rel.includes("/") || rel.includes("\\")) die(2, "--text-file must sit directly in .claude/state/rule-promote/");
  let fd, text;
  try {
    // lstat BEFORE open: a FIFO blocks open() for ever waiting for a writer. Then one descriptor: the file that is
    // measured is the file that is read (B2).
    if (!lstatSync(real).isFile()) die(2, "--text-file is not a plain file");
    fd = openSync(real, "r");
    const st = fstatSync(fd);
    if (!st.isFile()) die(2, "--text-file is not a plain file");
    if (st.size === 0) die(2, "--text-file is empty");
    if (st.size > TEXT_CAP) die(2, `--text-file is ${st.size} bytes -- a rule is at most ${TEXT_CAP}`);
    const buf = Buffer.alloc(TEXT_CAP + 1);
    const n = readSync(fd, buf, 0, TEXT_CAP + 1, 0);
    if (n > TEXT_CAP) die(2, `a rule is at most ${TEXT_CAP} bytes`);
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, n)); } catch { die(2, "--text-file is not valid UTF-8"); }
  } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closed */ } }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!text.trim()) die(2, "--text-file holds only whitespace");
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(text.replace(/\n/g, "").replace(/\t/g, ""))) die(2, "the rule's text holds a control, format or line-separator character");
  if (text.split("\n").length > LINES_CAP) die(2, `a rule is at most ${LINES_CAP} lines`);
  let hit = null;
  try { const v = scanSecrets(text, { text }, { maxCandidates: sizeScaledCap(text) }); if (v.hit) hit = v.rule; } catch { hit = "unscannable"; }
  if (hit) die(2, `the rule's text matches the secret rule ${hit} -- it would land on a public branch, so nothing is written`);
  return text;
}

/** The home must be CLAUDE.md or a .claude/rules/*.md that main already carries. */
async function checkHome(home) {
  if (home === "CLAUDE.md") return;
  const m = /^\.claude\/rules\/([a-z0-9][a-z0-9-]{0,60}\.md)$/.exec(home);
  if (!m) die(2, `--home is CLAUDE.md or .claude/rules/<name>.md, not ${JSON.stringify(home).slice(0, 80)}`);
  const { names } = await mainDirNames({ repo: REPO, dir: RULES_DIR });
  if (!names.includes(m[1])) die(2, `main carries no ${home} -- a rule gets an existing home (known: ${names.join(", ")})`);
}

/** The approval a written proposal raises. One builder, for the dry run and the real emit alike. */
export function approvalPayload({ home, lines, branch, base, commit, why }) {
  return {
    what: `add a ${lines}-line rule to ${home}`, gate: "rule",
    home, branch, base, commit,
    ...(why ? { why } : {}),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rule = readRuleText(args.textFile);
  await checkHome(args.home);
  const { base, text } = await baseText({ repo: REPO, path: args.home });
  if (text === null) die(2, `main has no ${args.home}`);
  // The rule is appended after one blank line; the file's last line is never rewritten.
  const proposed = `${text.replace(/\n*$/, "")}\n\n${rule}\n`;
  const lines = rule.split("\n").length;
  const tag = createHash("sha256").update(rule).digest("hex").slice(0, 8);
  // CLAUDE.md is `root-claude` and a rules file `rules-<name>`: a .claude/rules/claude.md can never share a branch stem
  // with CLAUDE.md (attack 3e97a85 B6).
  const stem = args.home === "CLAUDE.md" ? "root-claude" : `rules-${args.home.slice(RULES_DIR.length + 1, -3)}`;
  const branch = proposalBranch("memory-rule", `${stem}-${tag}`);
  const files = [{ path: args.home, content: proposed }];
  const approval = (commit) => approvalPayload({ home: args.home, lines, branch, base, commit, why: args.why });
  const flags = args.asProcess ? ["--process", args.asProcess] : [];
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)), { cwd: REPO, flags });
  if (refused) die(2, `the approval this proposal raises would be refused by the spine, so nothing is written: ${refused}`);
  const { what } = approval("");
  const message = `memory: ${what} (a proposal, /arc-retro step 2)\n\n${args.why ? `${args.why}\n\n` : ""}Written by the face's session door. Nothing changes until a human merges this branch.`;
  const digest = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)), flags });

  if (args.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow: [args.home], base });
    process.stdout.write(`rule-propose: would ${what}\n`);
    process.stdout.write(`rule-propose: a new branch ${branch} off main ${plan.base.slice(0, 12)}, then approval.requested to your inbox\n`);
    process.stdout.write(plan.diff.endsWith("\n") ? plan.diff : plan.diff + "\n");
    process.stdout.write(`commit message:\n${message.split("\n").map((l) => `  ${l}`).join("\n")}\n`);
    process.stdout.write("rule-propose: dry run -- no branch, no object, no receipt was written\n");
    process.stdout.write(expectLine(digest) + "\n");
    return;
  }
  if (args.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(args.expect, digest);
  if (stale) die(2, stale);
  // Only a branch this apply CREATES can make a failure "written": one that existed before it is a refusal
  // (BRANCH_EXISTS), whatever git says afterwards.
  if (!refExists(branch)) pendingBranch = branch;
  const w = await writeProposal({ repo: REPO, branch, files, allow: [args.home], message, base,
    beforeRef: (commit) => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval(commit), { cwd: REPO, flags }); if (no) die(2, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
  written = true;
  process.stdout.write(`rule-propose: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}\n`);
  process.stdout.write(w.diff.endsWith("\n") ? w.diff : w.diff + "\n");
  const got = emitReceipt(ARC_EVENT, "approval.requested", approval(w.commit), { cwd: REPO, timeoutMs: 60_000, flags });
  if (got.state !== "landed" || !got.id) {
    // An apply again is refused (the branch exists), so the way on is named here, exactly: the approval this run meant
    // to raise, written to the scratch file, and the one command that raises it (attack 3e97a85 B5).
    let recovery = "";
    try {
      const rel = [...SCRATCH, "approval.json"].join("/");
      writeFileSync(join(REPO, ...SCRATCH, "approval.json"), `${JSON.stringify(approval(w.commit))}\n`);
      recovery = ` Once you have looked in your inbox, raise it with: node .claude/scripts/hq/arc-event.mjs emit approval.requested --payload-file ${rel}${flags.length ? ` ${flags.join(" ")}` : ""}`;
    } catch { /* the message below still names the branch */ }
    const why = got.state === "refused" ? `its approval was not raised -- ${got.why}`
      : got.state === "unknown" ? `whether its approval landed is unknown -- ${got.why}`
      : `its approval landed without its id -- ${got.why}`;
    die(1, `the branch ${branch} IS written, and ${why}.${recovery}`);
  }
  process.stdout.write(`receipt: approval.requested ${got.id}\n`);
}

/** Does refs/heads/<branch> exist? Bounded, and asked of git itself. @param {string} branch */
function refExists(branch) {
  return spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
    { cwd: REPO, stdio: "ignore", timeout: 10_000, windowsHide: true }).status === 0;
}

// Run only as the CLI. Both sides realpathed: argv[1] beside import.meta.url silently no-ops behind a symlink.
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode already set */ }
    else {
      // Did the ref move before the throw? Asked of git, not of the flag: writeProposal can move the ref and then throw
      // (a diff read denied by a locked file) before `written` is set (attack 3e97a85 B4).
      const exists = written || (pendingBranch !== "" && refExists(pendingBranch));
      const why = e instanceof ProposalError ? `${e.code} -- ${e.message}` : (e instanceof Error ? e.message.split("\n")[0] : String(e));
      process.stderr.write(exists ? `rule-propose: the branch ${pendingBranch} IS written, and then this failed: ${why}\n` : `rule-propose: nothing was written: ${why}\n`);
      process.exitCode = exists ? 1 : 2;
    }
  }
}
