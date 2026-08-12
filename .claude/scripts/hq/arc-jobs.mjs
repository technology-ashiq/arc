#!/usr/bin/env node
/**
 * arc-jobs.mjs -- ONE wrapper, ONE enforcement path (SCH-C, REQ-02).
 *
 * Every execution, attended or scheduled, walks the same four steps in the same order:
 *
 *     lock -> guards -> execute -> receipt
 *
 * There is no second path. A scheduled fire and a human running the same job differ in exactly
 * one field, the receipt's actor, which is what makes REQ-06's "zero manual starts" a spine
 * QUERY rather than a diary claim.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO:
 *
 *  - It owns ZERO retries. ADR-0203 (transport, in-driver) and ADR-0204 (contract, in arc-run,
 *    terminating in a proposal receipt) already own the retry ladder. A scheduler-side retry
 *    would multiply ladders, which is precisely the retry storm the brief bans. A failed run's
 *    natural retry is its next cadence slot.
 *  - It never interprets policy. Authorization is `authorizeRun`'s answer and nothing else
 *    (POL-D). A second reading of policy in this file is the violation the shared library
 *    exists to prevent, and REQ-02's check greps for exactly that.
 *  - It never hand-rolls a lock. The per-job lock is the spine's own `withLock` with a per-job
 *    lock name -- that token-ownership discipline took three defects to get right and none of
 *    them is worth reproducing badly.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { spineRoot, withLock } from "./lib/spine-io.mjs";
import { formatIst, nowMs } from "./lib/canonical.mjs";
import { lintJobs } from "./lib/jobs/schema.mjs";
import { parseCadence, floorSlot, nextSlots, slotMs, istDay } from "./lib/jobs/cadence.mjs";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { processNames } from "./lib/policy/subjects.mjs";
import { policyRoot, authorizeRun } from "./lib/policy/run-gate.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const ARC_EVENT = resolve(process.platform === "win32" ? HERE.slice(1) : HERE, "arc-event.mjs");
const ARC_RUN = resolve(process.platform === "win32" ? HERE.slice(1) : HERE, "..", "engine", "arc-run.mjs");

// ---------- args ----------
const argv = process.argv.slice(2);
const command = argv[0];
const positional = argv.slice(1).filter((a) => !a.startsWith("--"));
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const has = (name) => argv.includes(`--${name}`);

const die = (code, msg) => { process.stderr.write(`arc-jobs: ${msg}\n`); process.exit(code); };

if (!command || command === "help" || has("help")) {
  process.stdout.write("usage: arc-jobs list [--next N] | run <name> [--slot ISO] [--scheduled]\n");
  process.exit(0);
}

// THE GOVERNING ROOT IS THIS MODULE'S OWN, never a caller-supplied one -- the same rule
// `run-gate` learned when `ARC_ROOT=/tmp/anywhere` turned out to be a one-variable disarm of
// the entire policy gate.
const root = policyRoot();

// ---------- the schedule, and it must be LEGAL before anything runs ----------
function loadSchedule() {
  const path = join(root, "hq.jobs.yaml");
  if (!existsSync(path)) die(1, `no hq.jobs.yaml at ${path} -- nothing is scheduled here`);
  const text = readFileSync(path, "utf8");

  let policy = null;
  const policyPath = join(root, "hq.policy.yaml");
  if (!existsSync(policyPath)) die(1, "no hq.policy.yaml -- every policy_kind would be unverifiable, so this is a refusal rather than a pass");
  try { policy = parsePolicyYaml(readFileSync(policyPath, "utf8")); }
  catch (e) { die(1, `hq.policy.yaml does not parse: ${e?.message || e}`); }

  let known = null;
  try { known = processNames(root); }
  catch (e) { die(1, `processes/ exists but cannot be read: ${e?.message || e}`); }

  // AN ILLEGAL SCHEDULE DOES NOT RUN. jobs-lint is the same rule set, so a job that could not
  // be committed cannot be executed either -- otherwise the validator is advice and the runner
  // is the real policy.
  const { findings } = lintJobs(text, { root, policy, processNames: known });
  if (findings.length) {
    for (const f of findings) process.stderr.write(`arc-jobs: [${f.code}] ${f.where}: ${f.message}\n`);
    die(2, `${findings.length} schedule violation(s) -- refusing to run anything from an illegal schedule`);
  }

  const parsed = parseYamlSubset(text);
  if (!parsed.ok) die(2, `hq.jobs.yaml does not parse: ${parsed.error.what}`);
  return { doc: parsed.value, policy, known };
}

// ---------- guards ----------
/**
 * A half-edited tree is not a tree to run scheduled work against. A merge or rebase in progress
 * means files on disk belong to no commit, so a job that reads them is reading a state nobody
 * authored -- and its receipt would name a HEAD that does not describe what actually ran.
 */
function gitStateBlocked() {
  const r = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (r.error || r.status !== 0) return null; // not a git repo: nothing to be mid-way through
  const gitDir = resolve(root, String(r.stdout || "").trim());
  for (const marker of ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD"])
    if (existsSync(join(gitDir, marker))) return marker;
  return null;
}

/** The process-stub document for a job, which is what `authorizeRun` reads its tools from. */
function processDoc(name) {
  const p = join(root, "processes", `${name}.process.yaml`);
  if (!existsSync(p)) return null;
  const parsed = parseYamlSubset(readFileSync(p, "utf8"));
  return parsed.ok ? parsed.value : null;
}

// ---------- receipts ----------
function emit(kind, payload, { actor, idem, outcome }) {
  const args = [ARC_EVENT, "emit", kind, "--payload", JSON.stringify(payload), "--strict"];
  if (actor) args.push("--actor", actor);
  if (idem) args.push("--idem", idem);
  if (outcome) args.push("--outcome", outcome);
  // `--strict` is not optional. arc-event runs in hook mode by default and exits 0 on EVERY
  // failure, so without it a quarantined or rejected receipt reads as a written one -- which is
  // how this lane's day-close job spent its first hour reporting sealed days it had not sealed.
  const r = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true });
  if (r.error) return { ok: false, why: `spawn failed: ${r.error.code || r.error.message}` };
  if (r.status !== 0) return { ok: false, why: String(r.stderr || "").trim().slice(0, 300) };
  return { ok: true, id: String(r.stdout || "").trim() };
}

// ---------- list ----------
if (command === "list") {
  const { doc } = loadSchedule();
  const n = Number(flag("next") || 0);
  const now = nowMs();
  for (const job of doc.jobs) {
    const cadence = parseCadence(job.cadence);
    const state = job.enabled ? "enabled " : "disabled";
    process.stdout.write(`${String(job.name).padEnd(22)} ${state}  ${String(job.cadence).padEnd(18)} ${job.type}\n`);
    if (n > 0 && job.enabled && cadence) {
      for (const t of nextSlots(cadence, now, n))
        process.stdout.write(`  ${formatIst(t)}\n`);
    }
  }
  process.exit(0);
}

// ---------- run ----------
if (command !== "run") die(2, `unknown command \`${command}\` (try: list | run)`);

const name = positional[0];
if (!name) die(2, "run needs a job name");

const { doc } = loadSchedule();
const job = (doc.jobs || []).find((j) => j.name === name);
if (!job) die(2, `no job named \`${name}\` in hq.jobs.yaml`);

const cadence = parseCadence(job.cadence);
if (!cadence) die(2, `job \`${name}\` has an unparseable cadence -- the schedule lint should have caught this`);

// THE SLOT IS COMPUTED, NOT ASSUMED. A normal fire floors to the nearest slot; `--slot` targets
// a specific missed one explicitly. Without that distinction the idem key lies: a catch-up run
// would claim the slot it happened to start in rather than the slot it is making good.
let slot;
if (flag("slot")) {
  const v = flag("slot");
  slot = Date.parse(v);
  if (!Number.isFinite(slot)) die(2, `--slot ${JSON.stringify(v)} is not a parseable instant`);
} else {
  slot = floorSlot(cadence, nowMs());
  if (slot === null) die(2, `job \`${name}\` has no slot at or before now -- nothing to run`);
}
const slotIso = formatIst(slot);

if (!job.enabled) {
  process.stdout.write(`arc-jobs: ${name} is disabled -- not running, and never counted overdue\n`);
  process.exit(0);
}

const scheduled = has("scheduled");
const actor = scheduled ? `scheduler:${name}` : (process.env.ARC_SPINE_ACTOR || "session");
const idem = `${name}@${slotIso}`;

// --- guard: the tree ---
const blocked = gitStateBlocked();
if (blocked) {
  emit("note.logged", { job: name, scheduled_for: slotIso, skipped: "git-state", marker: blocked },
    { actor, outcome: "ok" });
  process.stdout.write(`arc-jobs: ${name} skipped -- ${blocked} is present, so the tree is mid-operation\n`);
  process.exit(0);
}

// --- guard: policy (POL-D, and nothing else decides this) ---
const stub = processDoc(name);
const verdict = authorizeRun({ processName: name, doc: stub, root });
if (!verdict.mayInvoke) {
  const why = verdict.denials.map((d) => `${d.capability}:${d.level}`).join(", ");
  emit("incident.raised", { job: name, scheduled_for: slotIso, class: "policy-declined", denials: why },
    { actor, outcome: "fail" });
  die(2, `${name} is refused by policy (${why}) -- deny-by-default, and the schedule does not get a second opinion`);
}

// --- lock -> execute -> receipt ---
const started = nowMs();
const startedIso = formatIst(started);

// The lock lives beside the SPINE, not beside the repo. `withLock` builds its path from
// `eventsDir(root)`, so handing it the governing repo root would create `<repo>/events/` -- a
// lock nobody else takes, which is a lock that locks nothing. `spineRoot()` also refuses inside
// a linked worktree, which is the correct place for a scheduled job to stop.
const spine = spineRoot();

let result;
try {
  result = withLock(spine, () => {
    if (job.type === "script") {
      const entry = resolve(root, job.entry);
      const timeoutMs = Number(job.budget.min) * 60_000;
      const r = spawnSync(process.execPath, [entry], {
        encoding: "utf8", windowsHide: true, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, cwd: root,
      });
      return { r, timedOut: r.error && r.error.code === "ETIMEDOUT" };
    }
    // A process-job delegates to arc-run with the SAME budget flags a manual run of the same
    // kind would carry -- a scheduled job can never exceed what a human could ask for.
    const args = [ARC_RUN, "--process", job.entry, "--driver", "auto",
      "--budget", `inr=${job.budget.inr},min=${job.budget.min}`];
    const r = spawnSync(process.execPath, args, {
      encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024, cwd: root,
    });
    return { r, timedOut: false };
  }, { lockName: `.job-${name}.lock` });
} catch (e) {
  // A LOCK FAILURE IS LOUD AND LEAVES A RECEIPT. The second instance of a job overlapping
  // itself exits 2 and says so; silence here would make an overlap indistinguishable from a
  // clean run that did nothing.
  emit("incident.raised", { job: name, scheduled_for: slotIso, class: "overlap", detail: String(e?.code || e?.message || e) },
    { actor, outcome: "fail" });
  die(2, `${name} is already running (${e?.code || e?.message}) -- a job may not overlap itself`);
}

const { r, timedOut } = result;
const durationMs = nowMs() - started;
const outcome = timedOut ? "fail" : (!r.error && r.status === 0 ? "ok" : "fail");

const payload = {
  job: name,
  scheduled_for: slotIso,
  started_at: startedIso,
  duration_ms: durationMs,
  outcome,
  type: job.type,
};
if (timedOut) payload.timed_out_after_min = Number(job.budget.min);
if (r.error) payload.spawn_error = r.error.code || r.error.message;
if (r.status !== null && r.status !== undefined) payload.exit_code = r.status;

const receipt = emit("run.completed", payload, { actor, idem, outcome });
if (!receipt.ok)
  process.stderr.write(`arc-jobs: WARN the run finished but its receipt did not land: ${receipt.why}\n`);

if (r.stdout) process.stdout.write(r.stdout);
if (outcome !== "ok") {
  if (r.stderr) process.stderr.write(r.stderr);
  emit("incident.raised", { job: name, scheduled_for: slotIso, class: timedOut ? "timeout" : "crash", exit_code: r.status ?? null },
    { actor, outcome: "fail" });
  die(1, `${name} failed (${timedOut ? `timed out after ${job.budget.min}m` : `exit ${r.status}`})`);
}

process.stdout.write(`arc-jobs: ${name} ok in ${durationMs}ms (slot ${slotIso}, actor ${actor})\n`);
process.exit(0);
