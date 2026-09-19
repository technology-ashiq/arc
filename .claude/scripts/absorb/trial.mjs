#!/usr/bin/env node
// trial.mjs -- seal a blind A/B and raise it to the owner, with the bundle on a proposal branch (face v2 Phase 05
// kernel ring, ADR-1340; the seal itself is judgement.mjs, ADR-0603).
//
//   trial.mjs --candidate T-NN --variants a,b --fixtures f1,f2,f3 --evidence initiatives/absorb/... --correlation ID
//             [--dry-run | --expect D]
//
// --dry-run   judgement.mjs seal --dry-run: every check the seal makes, plus whether the proposal branch could be
//             written (a bundle main already holds is refused), plus the spine's judgment of a DRAFT of the approval
//             (the longest labels the pool holds, a zero commitment) -- an early answer only: the real labels are drawn
//             when it seals, and the seal judges the real payload itself (--judge) before its nonce is written.
//             Nothing is written. Its LAST line is the digest an apply is bound to ({"expect":"..."}): the branch,
//             main's commit and the seal's arguments.
// --expect D  refuses PLAN_STALE unless that digest still holds -- main moved, or the branch appeared -- BEFORE the
//             seal burns the correlation. Then judgement.mjs seal --bundle-dir <scratch>: the nonce goes to the
//             gitignored seal store as it always has; the bundle's commitment.txt is committed to a NEW branch
//             feat/face-absorb-trial-<correlation> at <evidence>/commitment.txt (core/proposal-branch.mjs: plumbing, no
//             checkout, the owner's tree untouched); then the seal's own payload is emitted as approval.requested (the
//             absorb.ab-judgement profile) and its id printed. The owner judges blind in the inbox; reveal stays
//             judgement.mjs reveal, after the decision.
// (neither)   refused: an apply is bound to a plan, by hand as by the door
//
// A seal burns its correlation. If the branch or the approval fails AFTER the seal, this says so, by name, and the
// next trial takes a new correlation -- never a silent retry that seals twice.
//
// Exit: 0 done · 1 sealed, but the branch or the receipt was not written (said so) · 2 refused, nothing sealed.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, proposalBranch, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal } from "../core/plan-expect.mjs";
import { LABEL_POOL } from "../hq/lib/validate-absorb.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const JUDGEMENT = join(HERE, "judgement.mjs");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const VALUE_FLAGS = ["--candidate", "--variants", "--fixtures", "--evidence", "--correlation", "--expect"];
const REQUIRED = ["--candidate", "--variants", "--fixtures", "--evidence", "--correlation"];
// The bundle is absorb's evidence: a path under the lane's own evidence tree, in plain segments.
const EVIDENCE_RE = /^initiatives\/absorb\/evidence\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class Stop extends Error {}
function die(code, msg) { process.stderr.write(`trial: ${msg}\n`); process.exitCode = code; throw new Stop(); }
// Set once the seal has burned the correlation: from then on every failure is exit 1, and says it sealed.
let sealed = false;

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
  if (!EVIDENCE_RE.test(out["--evidence"]) || out["--evidence"].split("/").some((s) => s === "." || s === ".."))
    die(2, `--evidence ${JSON.stringify(out["--evidence"])} is a bundle path under initiatives/absorb/evidence/, in plain segments`);
  return out;
}

/** Where judgement.mjs keeps a correlation's nonce: its own rule, resolved from the directory it runs in (REPO). */
const sealFile = (corr) => resolve(REPO, process.env.ARC_ABSORB_SEAL_DIR || join(".claude", "state", "absorb", "seals"), `${corr}.json`);

/** The judgement.mjs seal argv, from this tool's own flags. */
const sealArgs = (a) => ["seal", "--candidate", a["--candidate"], "--variants", a["--variants"], "--fixtures", a["--fixtures"], "--evidence", a["--evidence"], "--correlation", a["--correlation"]];

/**
 * The approval the seal will print, before it is drawn: the seal's own payload shape, with the LONGEST labels the pool
 * holds in place of the random ones and a zero commitment. The spine judges it before anything is sealed -- a secret
 * scanner that reads a correlation or a fixture name as a key refuses here, with nothing burned.
 */
function draftApproval(a) {
  const n = a["--variants"].split(",").map((s) => s.trim()).filter(Boolean).length;
  const labels = [...LABEL_POOL].sort((x, y) => y.length - x.length || (x < y ? -1 : 1)).slice(0, n);
  return { subject: "absorb.ab-judgement", candidate: a["--candidate"], fixtures: a["--fixtures"].split(",").map((s) => s.trim()).filter(Boolean), labels, commitment: "0".repeat(64), evidence_path: a["--evidence"], correlation: a["--correlation"] };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const branch = proposalBranch("absorb-trial", a["--correlation"]);
  const target = `${a["--evidence"]}/commitment.txt`;
  // Every check the seal makes, written nothing.
  const dry = spawnSync(process.execPath, [JUDGEMENT, ...sealArgs(a), "--dry-run"], { cwd: REPO, encoding: "utf8" });
  if (dry.status !== 0) die(2, String(dry.stderr || "").trim().replace(/^judgement: /, "") || `the seal's dry run exited ${dry.status}`);
  // The branch is free and main's commit is read ONCE: the digest and the write both use this base.
  const { base } = await checkProposal({ repo: REPO, branch, paths: [target], allow: [target] });
  // A bundle MAIN already holds is an earlier judgement's. The seal's own guard reads the owner's checkout, and the
  // branch is cut from main: a checkout on another branch passed, and the new branch replaced main's commitment.txt
  // beside that judgement's revealed mapping (PR 3b logic attack).
  for (const held of ["mapping.json", "commitment.txt"]) {
    const on = await baseText({ repo: REPO, path: `${a["--evidence"]}/${held}` });
    if (on.base !== base) die(2, "main moved while the bundle was checked -- plan again");
    if (on.text !== null) die(2, `main already holds ${a["--evidence"]}/${held} -- an earlier judgement's bundle; a new trial takes a new --evidence path, and nothing was sealed`);
  }
  const refused = spineRefusal(ARC_EVENT, "approval.requested", draftApproval(a), { cwd: REPO });
  if (refused) die(2, `the approval this trial raises would be refused by the spine, so nothing is sealed: ${refused}`);
  const digest = planDigest({ branch, base, target, seal: sealArgs(a) });
  if (a.dryRun) {
    process.stdout.write(dry.stdout);
    process.stdout.write(`trial: the commitment goes to ${target} on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested to your inbox\n`);
    process.stdout.write("trial: dry run -- nothing was sealed and no branch was written\n");
    process.stdout.write(expectLine(digest) + "\n");
    return;
  }
  // Bound to the plan BEFORE the seal burns the correlation -- and never unbound (PR 3a round-2 logic attack).
  if (a["--expect"] === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, then again with the --expect it prints -- nothing was sealed");
  const stale = staleReason(a["--expect"], digest);
  if (stale) die(2, stale);
  let scratch;
  try { scratch = mkdtempSync(join(tmpdir(), "arc-absorb-trial-")); }
  catch (e) { die(2, `no temp directory could be made (${e && e.code ? e.code : "error"}) -- nothing was sealed`); }
  try {
    // --judge: the spine judges the payload this seal prints -- its drawn labels, its commitment -- before its nonce is
    // written. The draft judged at plan could not: other labels passed where these are refused (PR 3b attacks).
    const run = spawnSync(process.execPath, [JUDGEMENT, ...sealArgs(a), "--bundle-dir", scratch, "--judge"], { cwd: REPO, encoding: "utf8" });
    if (run.status !== 0) {
      const why = String(run.stderr || "").trim().replace(/^judgement: /, "") || `the seal exited ${run.status}`;
      // A seal that failed AFTER writing its nonce has burned the correlation, whatever it exited: a failed
      // commitment.txt write was reported as "nothing sealed" while the nonce sat in the store (PR 3b shell attack).
      if (existsSync(sealFile(a["--correlation"]))) { sealed = true; die(1, `the seal failed part-way, AFTER its nonce was written: correlation ${a["--correlation"]} is used and nothing was raised -- ${why}. Trial again with a new correlation`); }
      die(2, why);
    }
    sealed = true;
    const payloadLine = String(run.stdout || "").trim().split(/\r?\n/).pop() || "";
    let payload;
    try { payload = JSON.parse(payloadLine); } catch { die(1, `sealed (correlation ${a["--correlation"]} is now used), and the seal printed no payload -- nothing was raised`); }
    let commitment;
    try { commitment = readFileSync(join(scratch, "commitment.txt"), "utf8"); } catch { die(1, `sealed (correlation ${a["--correlation"]} is now used), and no commitment.txt was written -- nothing was raised`); }
    let w;
    try {
      w = await writeProposal({ repo: REPO, branch, files: [{ path: target, content: commitment }], allow: [target], base,
        message: `absorb: the sealed commitment for ${payload.candidate}, correlation ${a["--correlation"]}\n\nThe labels are blind until the decision; judgement.mjs reveal writes the mapping afterwards.\nWritten by the face's work door (ADR-1340).` });
    } catch (e) { die(1, `sealed (correlation ${a["--correlation"]} is now used), and the branch was not written: ${e && e.code ? e.code : ""} ${e instanceof Error ? e.message : e} -- trial again with a new correlation`); }
    process.stdout.write(`trial: sealed ${payload.labels ? payload.labels.length : "?"} blind labels for ${payload.candidate}; the commitment is on ${branch} at ${w.commit.slice(0, 12)}\n`);
    const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(payload), "--strict"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const id = String(r.stdout || "").trim();
    if (r.status !== 0 || !ULID_RE.test(id))
      die(1, `sealed, and the branch ${branch} IS written, and the approval was not raised -- ${String(r.stderr || "").trim().split("\n").filter(Boolean)[0] || `the emitter exited ${r.status}`}`);
    process.stdout.write(`receipt: approval.requested ${id}\n`);
  } finally {
    // Litter, never the outcome: a cleanup that throws must not turn a sealed, written trial into a failure.
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
    else if (!sealed && e instanceof ProposalError) { process.stderr.write(`trial: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(sealed ? `trial: sealed (the correlation is now used), and then this failed: ${why}\n` : `trial: nothing was sealed: ${why}\n`);
      process.exitCode = sealed ? 1 : 2;
    }
  }
}
