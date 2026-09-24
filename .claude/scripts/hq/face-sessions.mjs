#!/usr/bin/env node
// face-sessions -- the SESSION door's verb registry (face v2 Phase 06; REQ-08, ADR-1326 · ADR-1334 · ADR-1339).
//
// ONE table, and the only place a session verb is spelled: the 15 SESSION rows of evidence/phase-05/cli-probe.md. A
// session is judgement work -- a council, a review, a phase close -- so no CLI can plan it the way the work door plans
// an op. What the door CAN hold fixed is HOW it starts: every row starts `arc-run --process <name> --driver <name>`,
// and nothing else. ADR-1326's rule is that the session door never names a harness binary; sessionCommand() is the one
// place an argv is built, and driverOnly() is the check the door runs on it before any spawn, so a row cannot reach a
// child without passing it.
//
// A row whose process has no file under processes/ is served, and refuses at start with NO_PROCESS naming the file
// the engine lane adds (additively, ADR-1339). It is never faked with a nearby process.
//
// `receipt` is the kind the verb claims, from the phase spec's table -- every one already in validate.mjs KINDS
// (ADR-0026). `null` means the kind is chosen in that verb's own PR, or the verb becomes a residue row. Whatever the row
// claims, the door shows only receipts the run PRINTED and the spine HOLDS: arc-run names its run.completed on stderr.
//
// Usage:
//   face-sessions.mjs --list    the registry as JSON (what face-coverage and the fixtures read)
//
// Exit: 0 printed | 2 bad arguments, or engine/drivers unreadable (said in one line).

import { readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { ONE_LINE_SRC } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The one script a session may start. */
export const SESSION_SCRIPT = "engine/arc-run.mjs";

/**
 * Programs a session must never start directly: the harnesses arc-run DRIVES. Their names are legal as the VALUE of
 * --driver (that is how a driver is picked) and nowhere else in the argv.
 */
export const HARNESS_BINARIES = Object.freeze(["claude", "claude-code", "codex", "hermes", "gemini", "opencode", "aider", "cursor-agent", "goose", "amp"]);

/**
 * The drivers arc-run can select, read off engine/drivers/ -- never written down twice. An unreadable directory THROWS:
 * "could not read" and "there are none" are different answers, and the second would refuse every driver as unknown.
 */
export function sessionDrivers() {
  return readdirSync(join(HERE, "..", "engine", "drivers"))
    .filter((f) => f.endsWith(".mjs") && f !== "common.mjs")
    .map((f) => f.slice(0, -4))
    .sort();
}

const PROCESS_RE = /^[a-z][a-z0-9-]{0,63}$/;
const DRIVER_RE = /^[a-z][a-z0-9-]{0,63}$/;

export class SessionError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

const text = (name, label, placeholder, max, required) =>
  Object.freeze({ name, label, placeholder, type: "text", max, pattern: ONE_LINE_SRC, required });
const lane = Object.freeze({ name: "lane", label: "Lane", placeholder: "face", type: "text", max: 64, pattern: "[a-z][a-z0-9-]*", required: true });
const phase = Object.freeze({ name: "phase", label: "Phase", placeholder: "06", type: "text", max: 2, pattern: "[0-9]{2}", required: true });

/**
 * @param {string} id @param {string} room @param {string} label @param {string} process
 * @param {string | null} kind @param {readonly any[]} fields @param {{ confirmStep?: string, pickProcess?: boolean }} [more]
 */
const row = (id, room, label, process, kind, fields, more = {}) => Object.freeze({
  id, room, label, process,
  receipt: kind ? Object.freeze({ kind }) : null,
  fields: Object.freeze(fields),
  // Every session reaches a model through arc-run's router: it spends unless the driver is mock.
  spends: true,
  // ship deploys outward: its session stops for the owner's confirmation before the deploy step (phase 06 spec). The door
  // refuses such a row (CONFIRM_STEP_UNENFORCED) until that stop is carried to arc-run and enforced there.
  confirmStep: more.confirmStep || null,
  // dispatch runs a process the owner names; every other row runs its own.
  pickProcess: more.pickProcess === true,
});

// A row's `room` is a SERVED room: the dock mounts under a module room, and a row pointing at a room the face does not
// serve is a verb nobody can reach (attack a320d86 B8). The probe's executor verbs therefore sit in engine-room, where
// the drivers and the router live -- the executor module is a labelled exemption, not a served room (ADR-1337).
export const SESSIONS = Object.freeze([
  row("council.convene", "council-chamber", "Convene the council", "council-convene", "council.verdict", [text("question", "The question", "one line -- what the council decides", 500, true)]),
  row("develop.proof", "develop", "Prove a slice", "develop-proof", "slice.done", [lane, phase]),
  row("develop.close-phase", "develop", "Close a phase", "phase-close", "phase.closed", [lane, phase]),
  row("review-ship.review", "review-ship", "Review the diff", "review-diff", "review.completed", [Object.freeze({ name: "base", label: "Base branch", placeholder: "main", type: "text", max: 100, pattern: "[A-Za-z0-9][A-Za-z0-9._/-]*", required: false })]),
  row("review-ship.qa", "review-ship", "Run QA", "qa-run", "qa.completed", [text("url", "URL", "http://localhost:3000", 300, true)]),
  row("review-ship.ship", "review-ship", "Ship", "ship-run", "ship.done", [], { confirmStep: "deploy" }),
  row("executor.hire", "engine-room", "Hire (certification)", "hire-certify", null, [text("candidate", "Candidate", "the runtime or agent to certify", 200, true)]),
  row("executor.dispatch", "engine-room", "Dispatch a process", "", "run.completed", [], { pickProcess: true }),
  row("memory.log-lesson", "memory", "Log a lesson", "lesson-log", "note.logged", [text("lesson", "The lesson", "one line -- what was learned", 500, true)]),
  row("memory.promote-rule", "memory", "Promote a rule", "rule-promote", "approval.requested", [text("rule", "The rule", "one line -- the rule to promote", 500, true)]),
  row("absorb.adopt", "absorb", "Adopt from absorb", "absorb-adopt", null, [text("item", "Item", "the absorbed item to adopt", 200, true)]),
  row("growth.draft", "growth", "Draft an article", "growth-draft", null, [text("topic", "Topic", "one line -- what the article is about", 300, true)]),
  row("strategy.adopt-plan", "strategy", "Adopt a plan", "kickoff-plan", "kickoff.done", [text("goal", "Goal", "one line -- the project goal", 500, true)]),
  row("strategy.record-adr", "strategy", "Record an ADR", "adr-record", "note.logged", [text("decision", "Decision", "one line -- what was decided", 500, true)]),
  row("org.lane-birth", "org", "Birth a lane", "kickoff-plan", "kickoff.done", [text("goal", "Goal", "one line -- the lane's goal", 500, true)]),
]);

/** @param {string} id */
export function sessionById(id) {
  const s = SESSIONS.find((r) => r.id === id);
  if (!s) throw new SessionError("UNKNOWN_SESSION", `"${id}" is not a session on this door (GET /api/sessions lists them)`);
  return s;
}

/**
 * Is `name` a process arc-run can start in `repo`? A FILE, resolving inside processes/ -- a directory of that name, or a
 * link out of the tree, is not a process (existsSync said yes to both).
 * @param {string} repo @param {string} name
 */
export function processFileOf(repo, name) {
  if (typeof name !== "string" || !PROCESS_RE.test(name)) return null;
  const p = join(repo, "processes", `${name}.process.yaml`);
  try {
    const real = realpathSync(p);
    if (!real.startsWith(realpathSync(join(repo, "processes")) + sep)) return null;
    return statSync(real).isFile() ? p : null;
  } catch {
    return null;
  }
}

/** The processes on this tree, for dispatch's select. @param {string} repo */
export function processNames(repo) {
  try {
    return readdirSync(join(repo, "processes")).filter((f) => f.endsWith(".process.yaml")).map((f) => f.slice(0, -".process.yaml".length)).filter((n) => PROCESS_RE.test(n)).sort();
  } catch {
    return [];
  }
}

/**
 * THE argv a session starts. Built as a list, one value per slot -- never joined and re-split -- so the owner's words
 * can hold spaces and never become a flag.
 * @param {string} process @param {string} driver @param {Record<string, string>} input @param {string} transcriptDir
 * @returns {{ script: string, args: string[] }}
 */
export function sessionCommand(process, driver, input, transcriptDir) {
  return {
    script: SESSION_SCRIPT,
    args: ["--process", process, "--driver", driver, "--input", JSON.stringify(input), "--transcript-dir", transcriptDir],
  };
}

/** The flags a session argv may carry, each with exactly one value after it. */
const SESSION_FLAGS = Object.freeze(["--process", "--driver", "--input", "--transcript-dir"]);
/** Flags whose value is free text (the owner's JSON, a machine path): whitespace is legal THERE and nowhere else. */
const FREE_VALUE = new Set(["--input", "--transcript-dir"]);

/**
 * The driver-only check (ADR-1326). Returns null when `cmd` starts arc-run with --process first and a named --driver
 * second, then only known flags each with one value; otherwise the reason, in words. A harness binary as the script or
 * as any stray argument, a joined argv (a flag with its value in one slot), a missing or empty --driver -- each refused.
 * @param {unknown} cmd @param {readonly string[]} [drivers]
 */
export function driverOnly(cmd, drivers = sessionDrivers()) {
  if (cmd === null || typeof cmd !== "object") return "no command";
  const { script, args } = /** @type {any} */ (cmd);
  if (script !== SESSION_SCRIPT) {
    const base = String(script).split(/[\\/]/).pop()?.replace(/\.(mjs|js|sh|exe|cmd)$/i, "") || "";
    return HARNESS_BINARIES.includes(base)
      ? `the command starts the harness "${base}" directly -- a session starts ${SESSION_SCRIPT} and names its driver`
      : `the command starts "${String(script)}", not ${SESSION_SCRIPT}`;
  }
  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) return "the argv is not a list of strings";
  if (args[0] !== "--process") return `the first argument is "${args[0]}", not --process`;
  if (!PROCESS_RE.test(args[1] || "")) return `the process "${args[1] ?? ""}" is not a process name`;
  if (args[2] !== "--driver") return `the third argument is "${args[2] ?? ""}", not --driver`;
  const driver = args[3];
  if (typeof driver !== "string" || driver === "") return "--driver has no value";
  if (!DRIVER_RE.test(driver) || (driver !== "auto" && !drivers.includes(driver))) return `--driver "${driver}" is neither auto nor a driver under engine/drivers/`;
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!SESSION_FLAGS.includes(flag)) {
      const base = flag.split(/[\\/]/).pop() || "";
      return HARNESS_BINARIES.includes(base) ? `the argv names the harness "${base}" outside --driver` : `"${flag}" is not a flag a session takes (a joined argv reads as one)`;
    }
    if (seen.has(flag)) return `${flag} is given twice`;
    seen.add(flag);
    if (i + 1 >= args.length) return `${flag} has no value`;
    const value = args[i + 1];
    if (value === "") return `${flag} has an empty value`;
    if (!FREE_VALUE.has(flag) && /\s/.test(value)) return `the value of ${flag} holds whitespace -- a joined argv, not one value per slot`;
    // A relative or empty transcript path resolves against arc-run's cwd -- the tracked repo root, where raw model
    // transcripts must never be written (attack 8e389a5 B10).
    if (flag === "--transcript-dir" && !isAbsolute(value)) return `--transcript-dir "${value}" is not an absolute path`;
    if (flag === "--input") {
      let parsed;
      try { parsed = JSON.parse(value); } catch { return "--input is not JSON"; }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "--input is not a JSON object";
    }
  }
  return null;
}

/** The registry as data: what --list prints and what GET /api/sessions serves. @param {string} repo */
export function sessionsView(repo) {
  return SESSIONS.map((s) => ({
    id: s.id, room: s.room, label: s.label, process: s.process || null,
    processReady: s.confirmStep ? false : s.pickProcess ? processNames(repo).length > 0 : processFileOf(repo, s.process) !== null,
    receipt: s.receipt, fields: s.fields, spends: s.spends, confirmStep: s.confirmStep, pickProcess: s.pickProcess,
  }));
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== "--list") {
    // exitCode, never exit(): exit() behind a pending pipe write can cut the line on Windows.
    process.stderr.write("usage: face-sessions.mjs --list\n");
    process.exitCode = 2;
  } else {
    // The library throws on an unreadable driver directory; the CLI says so in one line, never as a stack with paths.
    let drivers = null;
    try { drivers = sessionDrivers(); }
    catch (e) {
      process.stderr.write(`face-sessions: cannot read engine/drivers (${/** @type {any} */ (e).code || "error"})\n`);
      process.exitCode = 2;
    }
    if (drivers) process.stdout.write(JSON.stringify({ sessions: sessionsView(join(HERE, "..", "..", "..")), drivers }, null, 2) + "\n");
  }
}
