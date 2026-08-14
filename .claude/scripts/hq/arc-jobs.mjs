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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spineRoot, withLock, readIdemIndex } from "./lib/spine-io.mjs";
import { formatIst, nowMs, sha256Hex } from "./lib/canonical.mjs";
import { lintJobs } from "./lib/jobs/schema.mjs";
import { parseCadence, floorSlot, nextSlots, slotMs, istDay, isDayString } from "./lib/jobs/cadence.mjs";
import { processRunArgv } from "./lib/jobs/delegate.mjs";
import { makeWindowsScheduler, registerVerified, registrationFor, PINNED_SETTINGS, SchedulerError } from "./lib/jobs/scheduler-os.mjs";
import { derivePanel, needsYouLines, loadPanelInputs, loadSpineEvents } from "./lib/jobs/panel.mjs";
import { deriveAudit, needsYouHistory } from "./lib/jobs/audit.mjs";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { processNames } from "./lib/policy/subjects.mjs";
import { policyRoot, authorizeRun } from "./lib/policy/run-gate.mjs";
import { policyEnforcementGreen } from "./lib/jobs/policy-gate.mjs";

// `fileURLToPath`, NOT `new URL(...).pathname`. A URL path is PERCENT-ENCODED, so a repo under
// `C:\My Repos\arc` produced `...\My%20Repos\...\arc-event.mjs`, every spawn returned ENOENT, and
// every scheduled run died reporting "left no receipt" -- including the incident receipt for its
// own failure. Thirteen other files in this directory already used `fileURLToPath`; this was the
// one that did not. Same defect shape as the `file://` URL built from a shell variable that Git
// Bash rejected: a POSIX-looking path is not a URL.
const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = resolve(HERE, "arc-event.mjs");
const ARC_RUN = resolve(HERE, "..", "engine", "arc-run.mjs");

// ---------- args ----------
const argv = process.argv.slice(2);
const command = argv[0];

// THE FLAGS THAT TAKE A VALUE, NAMED. Without this list a flag's VALUE counts as a positional
// argument -- `run x --slot ISO` read as two positionals and only worked because nothing looked
// at the second, and `audit --to 2026-08-09` read as a stray positional the moment anything did.
// Naming them is also what lets an unknown flag be caught instead of ignored.
const VALUE_FLAGS = new Set(["next", "date", "slot", "from", "to"]);
const BOOL_FLAGS = new Set(["scheduled", "json", "partial", "help"]);

const positional = (() => {
  const out = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const name = a.slice(2).split("=")[0];
      if (VALUE_FLAGS.has(name) && !a.includes("=")) i++; // its value belongs to it, not here
      continue;
    }
    out.push(a);
  }
  return out;
})();
// A FLAG THAT WAS TYPED AND NOT UNDERSTOOD IS AN ERROR, NEVER A DEFAULT.
//
// The first version answered `null` for every malformed spelling -- `--to=D`, a trailing `--to`,
// `--to --partial`, `--to ""` -- and the caller then fell through to its default. So an operator
// who asked for one window got a confident verdict about a different one, with nothing in the
// output saying so. `.claude/rules/lanes.md` already rules this exact shape out in writing ("an
// unquoted empty value silently eats the next flag"), and it bans last-wins on a repeated flag
// for the same reason: silently picking one of two typed values is the "never guess" failure.
const flag = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) die(2, `write --${name} <value>, not ${eq} -- the = form is not parsed and would have been ignored`);
  const hits = argv.reduce((n, a, i) => (a === `--${name}` ? [...n, i] : n), []);
  if (hits.length > 1) die(2, `--${name} given ${hits.length} times -- that is an operator error, not a last-wins override`);
  if (!hits.length) return null;
  const i = hits[0];
  const v = i + 1 < argv.length ? argv[i + 1] : undefined;
  if (v === undefined || v === "" || v.startsWith("--"))
    die(2, `--${name} needs a value${v === "" ? " (it was given an empty one)" : ""}`);
  return v;
};
const has = (name) => argv.includes(`--${name}`);

const die = (code, msg) => { process.stderr.write(`arc-jobs: ${msg}\n`); process.exit(code); };

if (!command || command === "help" || has("help")) {
  process.stdout.write(
    "usage: arc-jobs list [--next N] | panel [--date D] | run <name> [--slot ISO] [--scheduled]\n" +
    "                    | catchup | register [name] | unregister [name]\n" +
    "                    | audit [--from D] [--to D] [--json] [--partial]\n",
  );
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

/**
 * THE OFF SWITCH READS THE SCHEDULE WITHOUT JUDGING IT.
 *
 * `loadSchedule` refuses on a missing policy file, an unparseable one, or any jobs-lint finding --
 * correct for anything that RUNS, and catastrophic for `unregister`, which used to go through it
 * too. Delete `hq.policy.yaml`, or remove a job's row from it, and the tasks stayed registered and
 * firing with no CLI path left to remove them: a gate holding the machine hostage rather than
 * protecting it.
 *
 * So this reads names best-effort and returns an empty list rather than dying. Nothing here
 * decides whether anything may run; it only helps name what to take away, and `os.list()` is the
 * authority on what is actually on the machine.
 */
function jobNamesBestEffort() {
  try {
    const path = join(root, "hq.jobs.yaml");
    if (!existsSync(path)) return [];
    const parsed = parseYamlSubset(readFileSync(path, "utf8"));
    if (!parsed.ok) return [];
    return (parsed.value.jobs || [])
      .map((j) => ({ name: String(j?.name ?? ""), enabled: j?.enabled === true }))
      .filter((j) => /^[a-z][a-z0-9-]*$/.test(j.name));
  } catch { return []; }
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

// ---------- the unattended surface, and the gate in front of it ----------
//
// SCH-G: `register` is the moment arc stops being attended, so it is the moment the policy
// interlock has to be VERIFIED rather than assumed. The gate itself lives in
// `lib/jobs/policy-gate.mjs` -- extracted so it can be handed a throwaway root and asked what it
// decides, instead of being testable only by breaking this repo's real policy file. THIS caller
// passes its own `policyRoot()` and never an argument.

// THE WEAKER GUARANTEE, SAID OUT LOUD. ADR-0803 pinned S4U so the jobs would fire whether or not
// anyone was logged on, and Amendment 1 moved the pin to `Interactive` because S4U cannot be
// registered without elevation on this machine. That is a real reduction in what the heartbeat
// promises, and the ADR itself wrote down that it "would need saying out loud in the brief panel"
// -- so it is printed on the panel and on every register rather than living only in an ADR nobody
// reads at 06:00.
//
// DERIVED from the pin, never a hardcoded sentence: if the logon model ever moves back to S4U,
// this line stops claiming a limit that no longer applies instead of quietly lying about one.
// Derived from a SET, not from `=== "S4U"`. Password and ServiceAccount also run while logged
// off, so the binary test would have made the panel announce a limitation that did not exist --
// the exact inverse of the property this line carries. Anything not on the list is treated as the
// weaker guarantee, which is the safe direction for a disclosure.
const UNATTENDED_LOGON = new Set(["S4U", "Password", "ServiceAccount"]);

function logonNote() {
  const t = PINNED_SETTINGS.LogonType;
  return UNATTENDED_LOGON.has(t)
    ? `logon model ${t} -- scheduled jobs fire whether or not you are logged on`
    : `logon model ${t} -- scheduled jobs fire ONLY while you are logged on; ` +
      "a slot falling while you are signed out is caught up late by StartWhenAvailable, not run on time";
}

function osScheduler() {
  if (process.platform !== "win32")
    die(2, "registration targets Windows Task Scheduler; POSIX cron is documented for consumer repos, not automated here (SCH-A)");
  return makeWindowsScheduler({
    scriptPath: join(root, ".claude/scripts/hq/lib/jobs/scheduler-task.ps1"),
    spawn: spawnSync,
  });
}

// THE OFF SWITCH, and it is a SEPARATE command block from `register` on purpose.
//
// It shared one block with register and therefore shared `loadSchedule()`, which refuses on a
// missing or unparseable `hq.policy.yaml` and on any jobs-lint finding. So deleting the policy
// file -- or removing one job's row from it -- left the OS tasks registered and firing with no CLI
// path left to remove them. The one surface required to work when everything else is broken was
// the one thing a broken repo could disable.
//
// It now reads names best-effort, accepts any name matching the task grammar (a job RENAMED in
// the schedule must still be removable by its old name), and treats `os.list()` as the authority
// on what is actually on the machine.
if (command === "unregister") {
  const only = positional[0] || null;
  if (only && !/^[a-z][a-z0-9-]*$/.test(only)) die(2, `\`${only}\` is not a task name`);

  const os = osScheduler();
  const removed = [];
  const stuck = [];

  const sweep = (name, label) => {
    // ONE FAILURE MUST NOT END THE SWEEP. `unregister` re-validates the name, and a single
    // foreign or capitalised task under the arc folder used to throw mid-loop and leave every
    // remaining task registered -- the off switch broken by a neighbour it does not own.
    try {
      const r = os.unregister(name);
      removed.push(`${name}${label}${r.existed ? "" : " (was not registered)"}`);
    } catch (e) {
      stuck.push(`${name}: ${e?.code || ""} ${e?.message || e}`);
    }
  };

  if (only) {
    sweep(only, "");
  } else {
    // Everything under the arc task folder that is not an ENABLED job goes, plus every enabled
    // job. A job set `enabled: false` while its task is still registered is precisely the case
    // that used to survive the sweep and keep firing into a wrapper that refuses to run it --
    // exiting 0, leaving no receipt, and rendering as `disabled` in the panel.
    const enabled = new Set(jobNamesBestEffort().filter((j) => j.enabled).map((j) => j.name));
    for (const n of enabled) sweep(n, "");
    let onMachine = [];
    try { onMachine = os.list(); }
    catch (e) { die(2, `cannot read the task list, so the sweep cannot be complete: ${e?.message || e}`); }
    for (const t of onMachine) if (!enabled.has(t)) sweep(t, " (not an enabled job)");
  }

  for (const r of removed) process.stdout.write(`arc-jobs: unregistered ${r}\n`);
  for (const s of stuck) process.stderr.write(`arc-jobs: COULD NOT REMOVE ${s}\n`);

  let left = [];
  try { left = os.list(); }
  catch (e) { die(2, `unregister ran but the task list cannot be read back, so the heartbeat state is UNKNOWN: ${e?.message || e}`); }
  process.stdout.write(`arc-jobs: ${left.length} arc task(s) remain${left.length ? `: ${left.join(", ")}` : " -- the heartbeat is off"}\n`);
  process.exit(stuck.length || left.length ? 2 : 0);
}

if (command === "register") {
  const { doc } = loadSchedule();
  const only = positional[0] || null;
  const targets = (doc.jobs || []).filter((j) => (only ? j.name === only : j.enabled));
  if (only && targets.length === 0) die(2, `no job named \`${only}\` in hq.jobs.yaml`);
  if (!only && targets.length === 0) die(2, "no enabled jobs to act on");

  // A DISABLED JOB IS NOT REGISTERABLE, even by name. Naming one used to schedule it anyway, and
  // the task then fired every slot into a wrapper that refuses to run a disabled job: exit 0, no
  // receipt, and a panel row reading `disabled` -- so the overdue detector stayed silent by
  // design while the machine ran a task nobody could see.
  const off = targets.filter((j) => j.enabled !== true).map((j) => j.name);
  if (off.length)
    die(2, `refusing to register ${off.join(", ")} -- disabled in hq.jobs.yaml; enable it there rather than scheduling it here`);

  // THE POLICY GATE RUNS BEFORE THE OS IS EVEN LOOKED UP, and the order is load-bearing rather
  // than tidy. Asked the other way round, every non-Windows machine refuses at the platform check
  // first, so a fixture asserting "a red gate exits 2" would pass on two of the three CI legs
  // without the gate having run at all -- a vacuous pass sitting exactly on top of the rule it
  // claims to protect. Refusing on policy first also states the right reason: this surface is
  // closed because enforcement is unproven, not because the OS is the wrong one.
  for (const job of targets) {
    const fails = policyEnforcementGreen(job.name, { root });
    if (fails.length) {
      for (const f of fails) process.stderr.write(`arc-jobs: policy gate: ${f}\n`);
      die(2, `refusing to register ${job.name} -- the unattended surface does not open while policy enforcement is unproven (SCH-G, fail-closed)`);
    }
  }

  const os = osScheduler();
  const nodePath = process.execPath;
  const logDir = join(spineRoot(), "job-logs");
  for (const job of targets) {
    // Register, read the whole registration back OFF THE OS, and unregister again if any part of
    // it disagrees -- all inside `registerVerified`, so the CLI and the contract fixture exercise
    // one function rather than two hopefully-identical copies of the same care.
    let back;
    try {
      const reg = registrationFor(job, { repoRoot: root, nodePath, logDir });
      back = registerVerified(os, reg.name, reg);
      process.stdout.write(
        `arc-jobs: registered ${reg.name}  ${reg.trigger}  lastTaskResult=${back.lastTaskResult}  cwd ${back.cwd}\n`,
      );
    } catch (e) {
      // EVERY SchedulerError becomes a stated refusal with exit 2. Only three codes used to be
      // handled; the rest escaped as an unhandled rejection -- a raw stack trace and exit 1, which
      // is indistinguishable from a dozen unrelated failures and says nothing about which jobs did
      // and did not land.
      if (e instanceof SchedulerError)
        die(2, `${job.name}: [${e.code}] ${e.message}${e.rolledBack === false ? " -- AND THE ROLLBACK ALSO FAILED, so remove it by hand" : ""}`);
      throw e;
    }
  }
  process.stdout.write(`arc-jobs: ${logonNote()}\n`);
  process.exit(0);
}

// ---------- panel ----------
//
// The full jobs table for one day, and the surface the brief's needs-you lines are derived from.
// A REPLAY, not a status read: `--date D` renders the schedule against the spine AS IT STOOD on
// D, so the same command on the same spine returns byte-identical output forever. `Date.now()`
// is absent from the derivation rather than merely discouraged -- one wall-clock read would make
// this untestable and the golden meaningless.
if (command === "panel") {
  const { doc } = loadSchedule();
  const day = flag("date") || istDay(nowMs());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) die(2, `--date ${JSON.stringify(day)} is not YYYY-MM-DD`);
  const { events, observedFrom } = await loadPanelInputs(spineRoot(), day);
  const rows = derivePanel({ day, jobs: doc.jobs || [], events, observedFrom });

  process.stdout.write(`jobs ${day}\n`);
  for (const r of rows) {
    const last = r.lastRun || "never";
    const next = r.nextExpected === null ? "—" : formatIst(r.nextExpected);
    // `disabled` is printed as a STATE, never as "0 missed". A deliberate off and a job that
    // happens to be up to date are different facts, and rendering them the same is how a
    // deliberate off starts reading as health.
    const state = !r.enabled ? "disabled" : (r.overdue ? `OVERDUE (${r.missed} missed)` : r.state);
    process.stdout.write(`  ${r.name.padEnd(22)} ${state.padEnd(22)} last ${last}  next ${next}\n`);
  }
  // Printed on EVERY panel, healthy or not. It is a standing property of the heartbeat rather
  // than an incident, and a limit that only appears when something is already wrong is a limit
  // nobody learns in time to plan around.
  process.stdout.write(`  ${logonNote()}\n`);
  const nag = needsYouLines(rows);
  if (nag.length) {
    process.stdout.write(`\nneeds-you (${nag.length})\n`);
    for (const l of nag) process.stdout.write(`  ${l}\n`);
  }
  process.exit(0);
}

/**
 * THE VERDICT RULES, in ONE place, so the human rendering and `--json` cannot drift.
 *
 * They are deliberately a list of failures rather than a score. Every entry is a fact somebody
 * must go and look at; there is no threshold to argue about and nothing to weight.
 */
function auditFailures(t) {
  const fails = [];
  if (t.unexplainedGaps > 0) fails.push(`${t.unexplainedGaps} unexplained gap(s)`);
  // A WEEK IN WHICH EVERY RUN CRASHED IS NOT A CLEAN WEEK. Failed runs used to be filed as
  // "explained gaps" -- a name that reads as health -- and appeared in no verdict rule at all, so
  // seven consecutive crashes graded CLEAN. The scheduler firing correctly is only half of what
  // the proving week is proving.
  if (t.failedSlots > 0) fails.push(`${t.failedSlots} slot(s) where the run FAILED`);
  if (t.incidents > 0) fails.push(`${t.incidents} incident(s) raised`);
  if (t.manualStarts > 0) fails.push(`${t.manualStarts} manual start(s) of a scheduled job`);
  if (t.spendInr !== 0) fails.push(`INR ${t.spendInr} spent by a job that must not spend`);
  if (t.badCosts > 0) fails.push(`${t.badCosts} cost field(s) that are negative, non-finite or not a number`);
  const undeclared = Object.keys(t.unknownIncidentClasses || {});
  if (undeclared.length) fails.push(`${undeclared.length} undeclared incident class(es)`);
  if (t.unknownOutcomes > 0) fails.push(`${t.unknownOutcomes} receipt(s) whose outcome is neither ok nor fail`);
  // A receipt that ran and cannot be placed against a slot is a finding in BOTH directions: its
  // slot may read as silence, and the run itself is unaccounted for.
  if (t.unmatchableReceipts > 0) fails.push(`${t.unmatchableReceipts} receipt(s) with no readable scheduled_for`);
  if (t.undatedEvents > 0) fails.push(`${t.undatedEvents} event(s) with an unreadable timestamp`);
  if (t.driftUnparsed > 0) fails.push(`${t.driftUnparsed} run(s) whose started_at could not be believed`);
  return fails;
}

/**
 * The schedule for a HISTORICAL read: parsed, never judged.
 *
 * Same reasoning as the off switch. `loadSchedule` refuses on a missing policy file or any
 * jobs-lint finding, which is right for anything that runs and wrong for a report about a week
 * that has already happened -- it would make the proving week's evidence unobtainable at exactly
 * the moment someone edits the schedule.
 */
function jobsForAudit() {
  const path = join(root, "hq.jobs.yaml");
  if (!existsSync(path)) die(2, `no hq.jobs.yaml at ${path} -- there is no schedule to audit against`);
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed.ok) die(2, `hq.jobs.yaml does not parse, so the audit has no schedule to measure against: ${parsed.error.what}`);
  return parsed.value.jobs || [];
}

// ---------- audit ----------
//
// The proving week's instrument. Written BEFORE the week had any data in it, because a
// measurement built after seeing the results can be tuned into one that flatters them without
// anyone meaning to. Everything below comes from the spine and from the schedule; the OS is never
// asked anything, so `--from D --to D` is a replay that returns the same answer forever.
if (command === "audit") {
  if (positional.length)
    die(2, `audit takes no positional arguments; got ${positional.map((p) => JSON.stringify(p)).join(", ")} -- use --from and --to`);

  // ONLY COMPLETE DAYS ARE AUDITABLE, and the default window ends YESTERDAY.
  //
  // A day still in progress has slots that have not arrived yet, and the derivation cannot tell
  // "has not come" from "did not happen" -- it would count every slot later today as MISSED. That
  // is this lane's recurring failure shape pointed at its own instrument: a detector reporting a
  // failure for something that has not occurred. It also corrupts the metric pack in the
  // direction that invites someone to widen the window until the number looks better.
  //
  // The calendar judgement lives HERE, at the CLI, where `nowMs()` already lives. `deriveAudit`
  // stays pure and simply measures the range it is given, so `--from D --to D` remains a replay.
  const today = istDay(nowMs());
  const yesterday = istDay(slotMs(today, 12, 0) - 86_400_000);

  // VALIDATE BEFORE COMPUTING. `from` derives from `to` through `slotMs`, which THROWS on a day it
  // cannot place -- so validating afterwards meant `--to garbage` escaped as an uncaught exception
  // and exit 1, which is this command's "measured, and not clean" code. A malformed argument
  // reading as a failed proving week is worse than either.
  //
  // And the check is `isDayString`, not the shape regex: `2026-02-30` matches YYYY-MM-DD and
  // `slotMs` silently rolls it to 2026-03-02, so expected slots would be computed for one day
  // while events were filtered by the string of another -- phantom MISSED slots and a NOT CLEAN
  // verdict for a week that ran perfectly. That is "validate one read, compare another", the
  // defect this lane has now paid for four times.
  const rawTo = flag("to");
  if (rawTo !== null && !isDayString(rawTo)) die(2, `--to ${JSON.stringify(rawTo)} is not a real calendar day (YYYY-MM-DD)`);
  const to = rawTo || yesterday;
  const rawFrom = flag("from");
  if (rawFrom !== null && !isDayString(rawFrom)) die(2, `--from ${JSON.stringify(rawFrom)} is not a real calendar day (YYYY-MM-DD)`);
  const from = rawFrom || istDay(slotMs(to, 12, 0) - 6 * 86_400_000);
  if (from > to) die(2, `--from ${from} is after --to ${to}`);

  if (to >= today && !has("partial"))
    die(2,
      `--to ${to} is today (${today}) or later, and a day that has not finished cannot be audited: every ` +
      `slot still to come would be counted MISSED. Audit up to ${yesterday}, or pass --partial to measure ` +
      `an incomplete day on purpose.`);

  // THE SCHEDULE IS READ WITHOUT BEING JUDGED, and for the same reason the off switch is.
  // `loadSchedule` refuses on a missing policy file or any jobs-lint finding -- correct for
  // anything that RUNS, and wrong here: this is a historical read of a week that already
  // happened, and the present legality of the schedule has no bearing on it. Gating it that way
  // would make the proving week's evidence unobtainable at exactly the moment someone edits the
  // schedule.
  const jobs = jobsForAudit();

  // EVERY OPERATIONAL FAILURE EXITS 2. Exit 1 means one thing only -- the pack was computed and is
  // not clean -- because that code is what a wrapper grading the proving week will branch on. A
  // spine that cannot be read, a schedule that cannot be parsed, or any uncaught throw reading as
  // "the week failed" would be the instrument inventing the result it exists to measure.
  let pack;
  let history;
  try {
    const { events: allEvents, observedFrom } = await loadSpineEvents(spineRoot());
    pack = deriveAudit({ from, to, jobs, events: allEvents, observedFrom });
    history = needsYouHistory({ from, to, jobs, events: allEvents, observedFrom, derivePanel });
  } catch (e) {
    die(2, `audit could not be computed: ${e?.message || e}`);
  }

  // The verdict is computed ONCE and shared by both renderings. Leaving `--json` to re-derive it
  // would let the machine-readable answer and the human one drift apart, and a consumer forced to
  // re-implement four rules will implement three.
  const fails = auditFailures(pack.totals);

  if (has("json")) {
    process.stdout.write(`${JSON.stringify({
      ...pack,
      needsYouHistory: history,
      verdict: { clean: fails.length === 0, fails },
    }, null, 2)}\n`);
    process.exit(fails.length ? 1 : 0);
  }

  const t = pack.totals;
  const ms = (v) => (v === null ? "n/a" : `${v}ms`);
  process.stdout.write(`jobs audit ${from}..${to}  (${t.windowDays} days, spine observed from ${t.observedFrom ?? "never"})\n`);
  // WHEN THE CALENDAR IS OVERRIDDEN, SAY SO. `nowMs()` honours `ARC_SPINE_NOW`, which twenty test
  // files export -- so "today", the entire basis of the complete-days guard, is settable from the
  // environment. That is correct for a replayable test and dangerous in a real reading, and the
  // difference between the two is whether anyone can tell. A disarmed guard must never be silent.
  if (process.env.ARC_SPINE_NOW)
    process.stdout.write(`  NOTE: ARC_SPINE_NOW is set, so "today" here is ${today}, not the wall clock\n`);
  process.stdout.write("\n");
  for (const r of pack.perJob) {
    const head = r.unreadableCadence ? "UNREADABLE CADENCE" : (r.enabled ? r.cadence : `${r.cadence} (disabled)`);
    process.stdout.write(`  ${r.name.padEnd(22)} ${head}\n`);
    process.stdout.write(`    expected ${r.expected}  completed ${r.completed}  failed ${r.failed}  drift p50 ${ms(r.driftP50Ms)}\n`);
    process.stdout.write(`    gaps: ${r.unexplainedGaps.length} unexplained, ${r.explainedGaps.length} explained, ${r.failedSlots.length} failed\n`);
    for (const g of r.unexplainedGaps) process.stdout.write(`      MISSED ${g}\n`);
    for (const g of r.failedSlots) process.stdout.write(`      FAILED ${g}\n`);
    for (const g of r.explainedGaps) process.stdout.write(`      (ok)   ${g.slot}  -- ${g.why} (by ${g.by})\n`);
    for (const u of r.unscheduledRuns) process.stdout.write(`      extra  ${u.slot}  x${u.count} (not an expected slot)\n`);
    for (const m of r.manualStarts) process.stdout.write(`      MANUAL ${m.slot ?? m.ts}  actor ${m.actor}\n`);
    for (const m of r.unmatchableReceipts) process.stdout.write(`      UNPLACED ${m.ts}  scheduled_for ${JSON.stringify(m.scheduled_for)}\n`);
    for (const m of r.unknownOutcomes) process.stdout.write(`      UNKNOWN-OUTCOME ${m.ts}  ${JSON.stringify(m.outcome)}\n`);
  }

  // The pre-declared pack, in the PLAN's own order, so it cannot be reordered into a better story.
  process.stdout.write("\nmetric pack\n");
  process.stdout.write(`  attempted ${t.completed + t.failed}  completed ${t.completed}  failed ${t.failed}  missed ${t.unexplainedGaps}\n`);
  process.stdout.write(`  drift p50                 ${ms(t.driftP50Ms)}${t.driftUnparsed ? `  (${t.driftUnparsed} unbelievable)` : ""}\n`);
  process.stdout.write(`  manual starts (target 0)  ${t.manualStarts}\n`);
  process.stdout.write(`  incidents                 ${Object.entries(t.incidentsByClass).map(([k, v]) => `${k}=${v}`).join(" ")}\n`);
  const unknown = Object.entries(t.unknownIncidentClasses);
  if (unknown.length)
    process.stdout.write(`  UNKNOWN incident classes  ${unknown.map(([k, v]) => `${k}=${v}`).join(" ")}  <- a class nobody declared\n`);
  process.stdout.write(`  spend (expected 0)        INR ${t.spendInr}\n`);
  process.stdout.write(`  needs-you days            ${history.length}\n`);
  for (const d of history)
    process.stdout.write(`    ${d.day}  ${d.overdue.map((o) => `${o.name} (${o.missed} missed)`).join(", ")}\n`);

  // A VERDICT, not just numbers. A pack that only ever prints figures leaves the reading of them
  // to whoever wants a particular answer, which is the failure the pre-declaration exists to stop.
  process.stdout.write(`\n${fails.length ? `NOT CLEAN: ${fails.join("; ")}` : "CLEAN against the pre-declared pack"}\n`);
  process.exit(fails.length ? 1 : 0);
}

// ---------- catchup ----------
//
// "Run everything that is due." Implemented by SPAWNING `arc-jobs run` per job rather than by
// calling an extracted helper, and that is a deliberate design choice rather than laziness: the
// PLAN's non-negotiable is that every execution walks ONE path, lock -> guards -> execute ->
// receipt. A second in-process code path would be free to drift out of agreement with the first
// one edit at a time, and the drift would be invisible until a scheduled run and a caught-up run
// behaved differently on the same job. Spawning the same command makes divergence impossible by
// construction: there is nothing else to drift from.
//
// SCH-E round-4 fix D3: this COMMAND runs every overdue job REGARDLESS of each job's `catchup:`
// field. That field governs only automatic late-firing by the OS. A human typing `catchup` is
// human intent, and the receipt's actor records exactly that.
if (command === "catchup") {
  const { doc } = loadSchedule();
  const spine = spineRoot();
  let index = null;
  try { index = readIdemIndex(spine); } catch { index = null; }
  const lookup = (k) => (index ? (index instanceof Map ? index.get(k) : index[k]) : null);

  const ran = [];
  const upToDate = [];
  const skipped = [];
  const failed = [];

  for (const job of doc.jobs || []) {
    if (!job.enabled) { skipped.push(`${job.name} (disabled)`); continue; }
    const c = parseCadence(job.cadence);
    if (!c) { skipped.push(`${job.name} (unreadable cadence)`); continue; }
    const due = floorSlot(c, nowMs());
    if (due === null) { skipped.push(`${job.name} (no slot yet)`); continue; }
    const dueIso = formatIst(due);

    if (lookup(sha256Hex(`${job.name}@${dueIso}`))) { upToDate.push(`${job.name} @ ${dueIso}`); continue; }

    process.stdout.write(`arc-jobs: catchup -> ${job.name} @ ${dueIso}\n`);
    const r = spawnSync(process.execPath, [process.argv[1], "run", job.name, "--slot", dueIso], {
      encoding: "utf8", windowsHide: true, stdio: "inherit",
    });
    if (r.error || r.status !== 0) failed.push(`${job.name} (${r.error ? r.error.code : `exit ${r.status}`})`);
    else ran.push(`${job.name} @ ${dueIso}`);
  }

  process.stdout.write(
    `arc-jobs: catchup ran=${ran.length} up_to_date=${upToDate.length} skipped=${skipped.length} failed=${failed.length}\n`,
  );
  for (const s of skipped) process.stdout.write(`  skipped: ${s}\n`);
  for (const f of failed) process.stderr.write(`  failed: ${f}\n`);
  process.exit(failed.length ? 1 : 0);
}

// ---------- run ----------
if (command !== "run") die(2, `unknown command \`${command}\` (try: list | run | catchup)`);

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

// SCH-E's identity is `<job>@<slot>`; the SPINE's wire format for an idem is lowercase sha256
// hex, and it rejects anything else outright (BAD_IDEM). So the semantic key is hashed, not
// written raw. The preimage is kept verbatim in the payload so a human reading a receipt can
// still see which slot it claims -- a hash nobody can invert is a poor thing to debug with.
const idemPreimage = `${name}@${slotIso}`;
const idem = sha256Hex(idemPreimage);

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

// DOUBLE-FIRE IS PREVENTED HERE, not merely noticed afterwards. Task Scheduler wake quirks fire
// the same slot twice, and SCH-E's rule is "never a silent second run" -- but letting the second
// run EXECUTE and relying on the receipt to be quarantined only makes it non-silent, not
// prevented. Both v1 jobs happen to be idempotent; the next one may not be, and by then this
// would be a bug nobody thinks to look for.
//
// The idem index is the spine's own dedup structure, so this asks the same question the emitter
// will ask, one step earlier. It is a fast path, not the guarantee: the emitter's DUP_IDEM
// remains the backstop for a genuine race between this read and that write.
try {
  const index = readIdemIndex(spine);
  const already = index && (index instanceof Map ? index.get(idem) : index[idem]);
  if (already) {
    process.stdout.write(
      `arc-jobs: ${name} slot ${slotIso} already has a receipt (${already}) -- this is a double fire, and the second run is skipped rather than re-executed\n`,
    );
    process.exit(0);
  }
} catch {
  // An unreadable index is not a reason to refuse: the emitter still enforces DUP_IDEM, so the
  // worst case is the slower path, never a duplicate.
}

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
    // kind would carry -- a scheduled job can never exceed what a human could ask for. The argv
    // is built by the shared builder rather than inline, so REQ-02 can compare the scheduled and
    // manual forms without spawning a driver to do it.
    const args = processRunArgv(job, { arcRunPath: ARC_RUN });
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
  idem_preimage: idemPreimage,
};
if (timedOut) payload.timed_out_after_min = Number(job.budget.min);
if (r.error) payload.spawn_error = r.error.code || r.error.message;
if (r.status !== null && r.status !== undefined) payload.exit_code = r.status;

const receipt = emit("run.completed", payload, { actor, idem, outcome });

// AN UNRECEIPTED RUN IS A FAILED RUN, and the first version of this file reported it as `ok`
// with a WARN on stderr -- which is the exact failure class this whole cycle exists to close.
// The work may well have succeeded; that is not the point. The receipt is what the brief reads,
// what the gap audit counts, and what REQ-06's actor query proves zero-manual-starts from. A
// job that runs forever and receipts nothing is INDISTINGUISHABLE from a dead one, so reporting
// success here would disable the very detector this module is built to feed.
//
// The two facts are reported separately rather than merged: the work outcome, and the receipt
// outcome. Collapsing them in either direction lies.
if (!receipt.ok) {
  if (r.stdout) process.stdout.write(r.stdout);
  // DUP_IDEM IS THE SYSTEM WORKING; ANY OTHER FAILURE IS THE SYSTEM BROKEN. Collapsing the two
  // was the first version's mistake: it told a benign double fire that it "left no receipt and
  // is indistinguishable from a job that never ran", which is false -- that slot HAS a receipt,
  // written by the run that got there first, and the duplicate is correctly quarantined.
  if (/DUP_IDEM/.test(receipt.why)) {
    process.stdout.write(
      `arc-jobs: ${name} slot ${slotIso} was already receipted; this duplicate is quarantined, not lost -- a double fire, surfaced rather than silent\n`,
    );
    process.exit(0);
  }
  emit("incident.raised", { job: name, scheduled_for: slotIso, class: "receipt-write-failure", detail: receipt.why },
    { actor, outcome: "fail" });
  process.stderr.write(`arc-jobs: the WORK ${outcome === "ok" ? "succeeded" : "failed"}, but its RECEIPT did not land: ${receipt.why}\n`);
  die(2, `${name} left no receipt -- an unreceipted run is invisible to the brief and to the gap audit, which makes it indistinguishable from a job that never ran`);
}

if (r.stdout) process.stdout.write(r.stdout);
if (outcome !== "ok") {
  if (r.stderr) process.stderr.write(r.stderr);
  emit("incident.raised", { job: name, scheduled_for: slotIso, class: timedOut ? "timeout" : "crash", exit_code: r.status ?? null },
    { actor, outcome: "fail" });
  die(1, `${name} failed (${timedOut ? `timed out after ${job.budget.min}m` : `exit ${r.status}`})`);
}

process.stdout.write(`arc-jobs: ${name} ok in ${durationMs}ms (slot ${slotIso}, actor ${actor})\n`);
process.exit(0);
