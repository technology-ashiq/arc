#!/usr/bin/env node
// pin.mjs -- pin a source and scaffold its extraction report on a proposal branch (face v2 Phase 05 kernel ring,
// ADR-1340; the scaffold itself is study.mjs --scaffold, REQ-01).
//
//   pin.mjs --root DIR --pin PIN --license TEXT --report initiatives/absorb/.../NAME.md [--dry-run | --expect D]
//
// study.mjs owns the one property absorb exists for -- studied code never executes -- and names no execution
// primitive anywhere; this file is the one that spawns. It runs study.mjs --scaffold into a scratch file, has the spine
// judge the approval it would raise, and then:
//
//   --dry-run   prints the report the scaffold would propose, as a diff against main, and as its LAST line the digest
//               of what an apply would write ({"expect":"..."}, core/plan-expect.mjs). Nothing is written anywhere.
//   --expect D  commits the report to a NEW branch feat/face-absorb-pin-<name> (core/proposal-branch.mjs: plumbing, no
//               checkout, the owner's tree untouched) -- only if what it would write is still D and main has not moved
//               -- then raises approval.requested naming the branch, the pin and the license, and prints its id. The
//               inventory is then filled by the studying session, on that branch.
//   (neither)   refused: an apply is bound to a plan, by hand as by the door
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkProposal, planProposal, proposalBranch, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const STUDY = join(HERE, "study.mjs");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const VALUE_FLAGS = ["--root", "--pin", "--license", "--report", "--expect"];
const REQUIRED = ["--root", "--pin", "--license", "--report"];
// A report is absorb's: a new markdown file under the lane's own tree, in plain segments.
const REPORT_RE = /^initiatives\/absorb\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\.md$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class Stop extends Error {}
function die(code, msg) { process.stderr.write(`pin: ${msg}\n`); process.exitCode = code; throw new Stop(); }
// Set once the branch is written: a failure after that is exit 1 ("the branch IS written"), never a refusal.
let written = false;

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { if (out.dryRun) die(2, "--dry-run given twice"); out.dryRun = true; continue; }
    if (a.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${a}`);
    if (!VALUE_FLAGS.includes(a)) die(2, `unknown argument ${JSON.stringify(a)} -- known: ${VALUE_FLAGS.join(" ")} --dry-run`);
    if (Object.hasOwn(out, a)) die(2, `${a} given twice; pick one`);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${a} needs a value`);
    out[a] = v;
    i++;
  }
  for (const f of REQUIRED) if (!out[f]) die(2, `${f} is required`);
  if (out.dryRun && out["--expect"] !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  for (const f of ["--pin", "--license"]) if (!isOneLine(out[f])) die(2, `${f} is one line of text, with no control or invisible characters`);
  if (!REPORT_RE.test(out["--report"]) || out["--report"].split("/").some((s) => s === "." || s === ".."))
    die(2, `--report ${JSON.stringify(out["--report"])} is a markdown path under initiatives/absorb/, in plain segments`);
  let st;
  try { st = statSync(out["--root"]); } catch { die(2, `--root ${out["--root"]} does not exist -- the source is fetched before it is studied, never by this`); }
  if (!st.isDirectory()) die(2, `--root ${out["--root"]} is not a directory`);
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const name = basename(a["--report"], ".md").toLowerCase().replace(/[^abcdefghijklmnopqrstuvwxyz0123456789-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const branch = proposalBranch("absorb-pin", name);
  let scratch;
  try { scratch = mkdtempSync(join(tmpdir(), "arc-absorb-pin-")); }
  catch (e) { die(2, `no temp directory could be made (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  try {
    // study.mjs refuses a report written into the source it studies; the scratch file is neither the source nor the tree.
    const out = join(scratch, "report.md");
    const s = spawnSync(process.execPath, [STUDY, "--scaffold", "--root", a["--root"], "--pin", a["--pin"], "--license", a["--license"], "--out", out], { cwd: REPO, encoding: "utf8" });
    if (s.status !== 0) die(2, String(s.stderr || "").trim().replace(/^study: /, "") || `the scaffold exited ${s.status}`);
    const body = readFileSync(out, "utf8");
    const files = [{ path: a["--report"], content: body }];
    const allow = [a["--report"]];
    // The branch is free and main's commit is read ONCE: the plan, the digest and the write all use this base.
    const { base } = await checkProposal({ repo: REPO, branch, paths: allow, allow });
    // The report's PATH, not its bare name, and first: the scanner also reads every string with its spaces removed, and
    // "pin risk-assessment at ..." became "sk-assessmentat0123..." -- a key -- while the path's "/" and "." end the run
    // (PR 3b logic attack, the branch's twin one field over).
    const what = `scaffold ${a["--report"]}, the extraction report for the source pinned at ${a["--pin"]}`;
    const approval = (commit) => ({ what, gate: "absorb-pin", pin: a["--pin"], license: a["--license"], report: a["--report"], branch, base, commit });
    // The approval is judged before anything is written: a refusal after the write would strand the branch.
    const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)), { cwd: REPO });
    if (refused) die(2, `the approval this pin raises would be refused by the spine, so nothing is written: ${refused}`);
    const message = `absorb: ${what}\n\nLicense: ${a["--license"]}\nThe technique inventory is filled by the studying session, on this branch.\nWritten by the face's work door (ADR-1340).`;
    // The digest covers every byte the apply writes: the branch, its base, the report, the commit message and the
    // approval with a placeholder commit (PR 3a round-2 logic attack: a reason outside the digest rode into both).
    const digest = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)) });
    if (a.dryRun) {
      const plan = await planProposal({ repo: REPO, branch, files, allow, base });
      // study's line names its --out, a scratch path, and the door withholds an absolute path AND everything after it:
      // the plan's diff and digest were hidden from the owner's page (PR 3b CI). Only its counts are carried.
      const counted = /\(([^()]*)\)\s*$/.exec(String(s.stdout).trim());
      process.stdout.write(`pin: scaffolded the extraction report${counted ? ` (${counted[1]})` : ""}\n`);
      process.stdout.write(`pin: the report goes to ${a["--report"]} on a new branch ${branch} off main ${plan.base.slice(0, 12)}, then approval.requested to your inbox\n`);
      process.stdout.write(plan.diff.endsWith("\n") ? plan.diff : plan.diff + "\n");
      process.stdout.write("pin: dry run -- no branch, no object, no receipt was written\n");
      process.stdout.write(expectLine(digest) + "\n");
      return;
    }
    // An apply is ALWAYS bound to a plan: no unbound hand-run mode (PR 3a round-2 logic attack, the propose twin).
    if (a["--expect"] === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
    const stale = staleReason(a["--expect"], digest);
    if (stale) die(2, stale);
    // The REAL approval, its commit included, is judged before the branch exists (writeProposal beforeRef; PR 3b attacks).
    const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
      beforeRef: (commit) => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval(commit), { cwd: REPO }); if (no) die(2, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
    written = true;
    process.stdout.write(`pin: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}\n`);
    const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(approval(w.commit)), "--strict"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const id = String(r.stdout || "").trim();
    if (r.status !== 0 || !ULID_RE.test(id))
      die(1, `the branch ${branch} IS written, and its approval was not raised -- ${String(r.stderr || "").trim().split("\n").filter(Boolean)[0] || `the emitter exited ${r.status}`}`);
    process.stdout.write(`receipt: approval.requested ${id}\n`);
  } finally {
    // Litter, never the outcome: a cleanup that throws must not turn a written proposal into a failure.
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
    else if (!written && e instanceof ProposalError) { process.stderr.write(`pin: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `pin: the branch IS written, and then this failed: ${why}\n` : `pin: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
}
