#!/usr/bin/env node
/**
 * arc-attack.mjs -- the PR loop's two-surface attacker pass, as governed engine work (ADR-0226).
 *
 *   node .claude/scripts/engine/arc-attack.mjs (--base REF | --since SHA) [--lane NAME]
 *        [--phase NN] [--round K] [--classification internal-only|external-ok] [--driver mock]
 *        [--root PATH] [--status-file PATH]
 *
 * EVERY SURFACE HAS A DEADLINE, AND SAYS WHERE IT IS (engine bug, 2026-09-26: a logic run sat silent for ~1.5 h).
 * Each surface runs arc-run with `--budget min=<ARC_ATTACK_MINUTES, default 30>`, so arc-run and the driver end it at
 * the deadline. While it runs, one heartbeat line every ARC_ATTACK_HEARTBEAT_MS (default 60 s) goes to stderr --
 * elapsed, deadline -- and, with --status-file, overwrites that ONE file with the same line, so a watcher reads one
 * line instead of a log. A watchdog past the deadline plus a grace ends a child that outlives its own budget. None of
 * this calls a model: the heartbeat costs nothing to produce and nothing to read.
 *
 * CLASSIFICATION IS internal-only UNLESS SAID OTHERWISE (review W2). This script is synced into
 * private venture repos; their diffs must not reach a model by default. ADR-0219's data boundary
 * sends an internal-only input to no driver at all, so internal-only is refused up front (exit 2).
 * Pass `--classification external-ok` only for a repo whose code is public anyway -- arc is.
 *
 * Builds one input per surface (build-attack-input.mjs), runs `arc-run --process attack-diff` once
 * per surface, checks each validated output answers the surface it was asked about, writes it to
 * the lane's evidence dir as `attack-<sha7>-r<K>-<surface>.json`, and prints one screen.
 * It NEVER fixes and NEVER commits: fix slices stay in the interactive session (/arc-develop).
 *
 * Routing, per ADR-0226:
 *   boundary -> `--driver auto`: router class `attack-diff` (balanced-workhorse, claude-code).
 *   logic    -> `--driver generic-api --trial-model $ARC_ATTACK_TRIAL_MODEL`, an ADR-0069(g) /
 *               ADR-0220 trial: receipted `model_source: trial`, no router row, no tier change.
 *               With the variable unset the logic surface is NOT RUN, said loudly, and the exit is
 *               non-zero. It is never faked, and never quietly rerouted to the boundary's model.
 *   --driver mock -> both surfaces replay recordings (ARC_MOCK_DIR, fixture id = the surface), so
 *               CI can prove the whole path end to end with no provider.
 *
 * Round K > 1 attacks the FIXES: each surface's prior findings are the ONE
 * `attack-*-r<K-1>-<surface>.json` in the evidence dir. Zero or several is an error, never a guess.
 *
 * Exit: 0 both surfaces ran · 1 a run failed or answered the wrong question · 2 usage/operator
 * error · 3/4/5 lane ambiguous/unknown/invalid (lane-resolve's codes, before anything runs) ·
 * 6 the diff is empty · 7 the logic surface was NOT RUN (the boundary result is still written).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { laneHeader, renderHuman, resolveLane } from "../core/lane-resolve.mjs";
import { DENY_RULES } from "../hq/lib/redact.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/@{}~^-]*$/;
const SURFACES = ["logic", "boundary"];
const PREFIX = { logic: "L", boundary: "B" };
const SEVERITIES = ["critical", "high", "medium", "low"];

function usage(msg) {
  if (msg) process.stderr.write(`arc-attack: ${msg}\n`);
  process.stderr.write("usage: arc-attack.mjs (--base REF | --since SHA) [--lane NAME] [--phase NN] [--round K] [--classification internal-only|external-ok] [--driver mock] [--root PATH]\n");
  return 2;
}

export function parseArgs(argv) {
  const o = { base: null, since: null, lane: "", laneGiven: false, laneDup: false, phase: null, round: "1", driver: null, root: null, classification: "internal-only", statusFile: null };
  const FLAGS = { "--base": "base", "--since": "since", "--lane": "lane", "--phase": "phase", "--round": "round", "--driver": "driver", "--root": "root", "--status-file": "statusFile", "--classification": "classification" };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.includes("=") && a.startsWith("--")) return { error: `\`${a}\`: write the value as a separate argument (--flag VALUE)` };
    const key = FLAGS[a];
    if (!key) return { error: `unknown argument \`${a}\`` };
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    i++;
    if (key === "lane") { if (o.laneGiven && o.lane !== v) o.laneDup = true; o.lane = v; o.laneGiven = true; continue; }
    if (seen.has(key) && o[key] !== v) return { error: `${a} given twice with different values` };
    seen.add(key);
    o[key] = v;
  }
  if (!o.base === !o.since) return { error: "give exactly one of --base or --since" };
  const ref = o.base ?? o.since;
  if (!REF_RE.test(ref)) return { error: `\`${ref}\` is not a revision this script will hand to git` };
  // `mock` is the only driver override. Any other name would let a caller point an attacker at a
  // driver ADR-0226 did not route it to -- and the logic surface's trial would lose its receipt.
  if (o.driver !== null && o.driver !== "mock") return { error: `--driver accepts only \`mock\` (got \`${o.driver}\`); real runs are routed per ADR-0226` };
  // FAIL CLOSED: a diff is internal-only unless the caller says otherwise. The script is synced into
  // private venture repos, and a hard-coded external-ok sent their diffs to a hosted model (review W2).
  if (!["internal-only", "external-ok"].includes(o.classification)) return { error: `--classification must be internal-only or external-ok (got \`${o.classification}\`)` };
  if (!/^[1-9][0-9]?$/.test(o.round)) return { error: `--round must be an integer 1-99 (got \`${o.round}\`)` };
  if (o.phase !== null && !/^[0-9]{1,3}$/.test(o.phase)) return { error: `--phase must be a phase number (got \`${o.phase}\`)` };
  return { opts: o };
}

function git(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || "").trim().split("\n")[0]}`);
  return r.stdout.trim();
}

/** The evidence dir for a lane (or root-mode), from --phase or the tracker header's `phase:`. */
function evidenceDir(root, lane, phaseArg) {
  let phase = phaseArg;
  if (phase === null) {
    const header = laneHeader(join(root, lane.tracker, "PROGRESS.md"));
    const m = String(header.phase ?? "").match(/^([0-9]{1,3})\b/);
    if (!m) return { error: `no --phase given and ${join(lane.tracker, "PROGRESS.md")} has no numeric \`phase:\` header -- name the phase` };
    phase = m[1];
  }
  const nn = phase.padStart(2, "0");
  const rel = lane.mode === "lane" ? join(lane.tracker, "evidence", `phase-${nn}`) : join("docs", "evidence", `phase-${nn}`);
  return { dir: join(root, rel), rel, nn };
}

/**
 * Round K>1: the ONE prior output for this surface, or an error that names what was found. A phase that lands as
 * several PRs holds one round-(K-1) result PER PR in the same evidence dir, so when more than one is there the prior is
 * the one whose commit is in THIS diff's range -- reachable from HEAD and not from the base. Still exactly one, or
 * refused: an ambiguity the range does not resolve is never guessed (face Phase 06, PRs #269 and #270).
 * @param {string} dir @param {number} round @param {string} surface @param {(sha: string) => boolean} [inRange]
 */
function priorFor(dir, round, surface, inRange) {
  if (round === 1) return { file: null };
  const want = new RegExp(`^attack-([0-9a-f]{7,40})-r${round - 1}-${surface}\\.json$`);
  const hits = existsSync(dir) ? readdirSync(dir).filter((f) => want.test(f)).sort() : [];
  // EVERY hit is range-checked, one included: a lone prior from ANOTHER PR of the phase was fed to this PR's attacker
  // as its own findings (round-2 attack d90c3b1 B5). A range question git refuses is a refusal, never a guess.
  let inThisDiff;
  try { inThisDiff = inRange ? hits.filter((f) => inRange(/** @type {RegExpExecArray} */ (want.exec(f))[1])) : hits; }
  catch (e) { return { error: `round ${round}: the round-${round - 1} ${surface} result could not be placed in this diff's range -- ${/** @type {Error} */ (e).message}` }; }
  if (inThisDiff.length !== 1)
    return { error: `round ${round} needs exactly one round-${round - 1} ${surface} result in this diff's range in ${dir}; found ${hits.length} (${inThisDiff.length} in range)${hits.length ? `: ${hits.join(", ")}` : ""}` };
  return { file: join(dir, inThisDiff[0]) };
}

/**
 * Is `sha` a commit of the range (ref..HEAD] in `root`? git's own answer, read by its status: 0 yes, 1 no, anything
 * else -- a ref it cannot resolve, a spawn error, a timeout -- THROWS, so a refusal is never read as "not an ancestor"
 * and so "in range" (round-2 attack d90c3b1 B4). Bounded, with git's location variables withheld, so a GIT_DIR from a
 * hook cannot answer for another repository (B6).
 */
function inDiffRange(root, ref, sha) {
  if (typeof ref !== "string" || ref === "" || ref.startsWith("-")) throw new Error(`the range's base ${JSON.stringify(ref)} is not a ref`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith("GIT_")));
  const g = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", env, timeout: 15_000, windowsHide: true });
  const why = (r) => `${r.error ? r.error.message : `exit ${r.status}`}: ${String(r.stderr || "").trim().split("\n")[0]}`;
  // The base must resolve, or no answer about the range means anything.
  const base = g(["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]);
  if (base.status !== 0) throw new Error(`the range's base ${JSON.stringify(ref)} does not resolve to a commit (${why(base)})`);
  // A prior named for a commit this repository does not hold is not of this diff: out of range, not a refusal.
  if (g(["cat-file", "-e", `${sha}^{commit}`]).status !== 0) return false;
  const anc = (a, b) => {
    const r = g(["merge-base", "--is-ancestor", a, b]);
    if (r.status === 0) return true;
    if (r.status === 1) return false;
    throw new Error(`git merge-base --is-ancestor ${a} ${b} answered ${why(r)}`);
  };
  return anc(sha, "HEAD") && !anc(sha, base.stdout.trim());
}

/**
 * The output answered the question it was asked, or it is refused. arc-run has already held it to
 * the schema; the schema cannot know WHICH surface this run was for. A logic run that came back
 * as `surface: boundary` would be filed under the wrong name and the logic surface would read as
 * attacked when it was not.
 */
export function checkAnswer(doc, surface) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "the output is not a JSON object";
  if (doc.surface !== surface) return `asked for the ${surface} surface, the answer says \`${doc.surface}\``;
  if (!Array.isArray(doc.findings)) return "`findings` is not a list";
  const bad = doc.findings.find((f) => !f || typeof f.id !== "string" || f.id[0] !== PREFIX[surface]);
  if (bad) return `finding \`${bad && bad.id}\` does not carry the ${surface} prefix \`${PREFIX[surface]}\``;
  return null;
}

/** Why an existing evidence file is NOT a usable result, or null when it is one. */
function recordedProblem(target, surface) {
  let doc;
  try { doc = JSON.parse(readFileSync(target, "utf8")); }
  catch (e) { return e.code ? `unreadable: ${e.code}` : "not valid JSON (a write cut short?)"; }
  return checkAnswer(doc, surface);
}

/**
 * EXCLUSIVE CREATE, exported so the race can be pinned directly. The preflight and the write are
 * minutes apart (a model call sits between them), so a second run for the same round passed the
 * preflight too and the slower one silently overwrote the faster one's evidence (attack B2).
 * Returns null on success, or the error code; an existing file is never touched.
 */
export function writeEvidence(target, doc) {
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return null;
  } catch (e) {
    return e.code || e.message;
  }
}

const CHILD_CAP = 64 * 1024 * 1024;
const clock = (ms) => new Date(ms).toTimeString().slice(0, 5);
export const elapsed = (ms) => `${Math.floor(ms / 60_000)}m${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}s`;

/**
 * The timing knobs, read once and refused when malformed: a deadline that parses as nothing must never mean "none".
 * @param {Record<string, string | undefined>} env
 */
export function timing(env) {
  const num = (name, dflt, lo, hi) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return dflt;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < lo || v > hi) return { error: `${name}=${JSON.stringify(raw)} is not a number from ${lo} to ${hi}` };
    return v;
  };
  const minutes = num("ARC_ATTACK_MINUTES", 30, 0.01, 240);
  const heartbeatMs = num("ARC_ATTACK_HEARTBEAT_MS", 60_000, 50, 600_000);
  const graceMs = num("ARC_ATTACK_GRACE_MS", 60_000, 0, 600_000);
  for (const v of [minutes, heartbeatMs, graceMs]) if (typeof v === "object") return v;
  return { minutes: /** @type {number} */ (minutes), heartbeatMs: /** @type {number} */ (heartbeatMs), graceMs: /** @type {number} */ (graceMs) };
}

/** Overwrite the ONE status line, whole: a reader never sees half of one (temp + rename). A failure is a WARN, not a stop. */
function writeStatus(file, line) {
  if (!file) return;
  const tmpFile = `${file}.${process.pid}.tmp`;
  try { writeFileSync(tmpFile, `${line}\n`); renameSync(tmpFile, file); }
  catch (e) { process.stderr.write(`arc-attack: WARN the status file could not be written (${e.code || "error"})\n`); }
}

/**
 * One surface, run ASYNC so it can say where it is while it runs. arc-run gets `--budget min=` and ends itself at the
 * deadline; the watchdog is only the backstop for a child that outlives its own budget by the grace.
 */
function runSurface({ root, surface, input, driver, trialModel, env, label, time, statusFile }) {
  const args = [join(HERE, "arc-run.mjs"), "--process", "attack-diff", "--root", root, "--input", `@${input}`, "--budget", `min=${time.minutes}`];
  // Stream mode: the driver's own lines (one per transport attempt) reach this process as they happen, not after the
  // run -- the heartbeat quotes the latest one. arc-run cleans each live line (liveLine) before it is passed on.
  const childEnv = { ...env, ARC_RUN_STREAM: "1" };
  if (driver === "mock") { args.push("--driver", "mock"); childEnv.ARC_MOCK_FIXTURE = surface; }
  else if (surface === "logic") args.push("--driver", "generic-api", "--trial-model", trialModel);
  else args.push("--driver", "auto");
  return runWatched({ argv: args, cwd: root, env: childEnv, label, time, statusFile });
}

/**
 * Any node child, watched: a started line, a heartbeat every `time.heartbeatMs` quoting the child's latest stderr line,
 * a status file overwritten with the same line, and a watchdog that SIGKILLs the child `time.graceMs` past its deadline.
 * Exported so the watchdog can be proven on a child that truly hangs -- arc-run under a real budget ends itself first.
 * @param {{ argv: string[], cwd: string, env: Record<string, string | undefined>, label: string,
 *   time: { minutes: number, heartbeatMs: number, graceMs: number }, statusFile: string | null }} p
 */
export function runWatched({ argv: args, cwd: root, env: childEnv, label, time, statusFile }) {
  const started = Date.now();
  const deadline = started + time.minutes * 60_000;
  const first = `${label}: started ${clock(started)} · deadline ${clock(deadline)} (${time.minutes}m)`;
  process.stderr.write(`${first}\n`);
  writeStatus(statusFile, first);
  return new Promise((done) => {
    /** @type {Buffer[]} */ const out = []; /** @type {Buffer[]} */ const err = [];
    let outBytes = 0, errBytes = 0, killed = false, error = null;
    let child;
    try { child = spawn(process.execPath, args, { cwd: root, env: childEnv, windowsHide: true }); }
    catch (e) { done({ status: null, stdout: "", stderr: "", error: e, killed: false, ms: 0 }); return; }
    child.stdout.on("data", (c) => { outBytes += c.length; if (outBytes <= CHILD_CAP) out.push(c); });
    let lastLine = "";
    child.stderr.on("data", (c) => {
      errBytes += c.length;
      if (errBytes <= CHILD_CAP) err.push(c);
      const seen = String(c).split(/\r?\n/).map((l) => oneLine(l).trim()).filter(Boolean);
      if (seen.length) lastLine = seen[seen.length - 1].slice(0, 120);
    });
    const beat = setInterval(() => {
      const line = `${label}: running ${elapsed(Date.now() - started)} · deadline ${clock(deadline)}${lastLine ? ` · last: ${lastLine}` : ""}`;
      process.stderr.write(`${line}\n`);
      writeStatus(statusFile, line);
    }, time.heartbeatMs);
    const watchdog = setTimeout(() => { killed = true; try { child.kill("SIGKILL"); } catch { /* already gone */ } }, time.minutes * 60_000 + time.graceMs);
    child.on("error", (e) => { error = e; });
    child.on("close", (code) => {
      clearInterval(beat);
      clearTimeout(watchdog);
      const ms = Date.now() - started;
      writeStatus(statusFile, `${label}: ended after ${elapsed(ms)}${killed ? " -- ended by the watchdog at the deadline" : ` (exit ${code})`}`);
      done({ status: killed ? null : code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8"), error, killed, ms });
    });
  });
}

// One line per field, always. A finding is MODEL OUTPUT: a `why` carrying "\n" printed a forged
// summary header and a forged finding of its own, byte-identical to real output (boundary attack B3).
// Built from code points, not typed escapes: C0 controls, DEL, and the two Unicode line separators.
const CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127, 0x2028, 0x2029)}]+`, "g");
const oneLine = (s) => String(s ?? "").replace(CONTROL, " ");

function summarize(surface, doc, rel) {
  const counts = SEVERITIES.map((s) => `${doc.findings.filter((f) => f.severity === s).length} ${s}`).join(" · ");
  const out = [`${surface.toUpperCase()}: ${doc.findings.length} finding(s) -- ${counts} -> ${rel}`];
  for (const f of doc.findings) {
    const line = `  ${oneLine(f.id)} [${oneLine(f.severity)}] ${oneLine(f.where)} -- ${oneLine(f.why)}${f.twin_of ? ` (twin of: ${oneLine(f.twin_of)})` : ""}`;
    out.push(line.length > 200 ? `${line.slice(0, 197)}...` : line);
  }
  return out;
}

export async function main(argv, env = process.env) {
  const parsed = parseArgs(argv);
  if (parsed.error) return usage(parsed.error);
  const o = parsed.opts;
  // Timing is read before anything runs: a malformed deadline refuses the pass, it never means "no deadline".
  const time = timing(env);
  if ("error" in time) return usage(time.error);
  let root;
  try { root = resolve(o.root || git(process.cwd(), ["rev-parse", "--show-toplevel"])); }
  catch (e) { return usage(e.message); }

  const lane = resolveLane({ root, lane: o.lane, laneGiven: o.laneGiven, laneDup: o.laneDup, surface: "attack" });
  if (lane.code !== 0) { for (const l of renderHuman(lane)) process.stderr.write(`${l}\n`); return lane.code; }
  if (lane.mode === "lane") process.stdout.write(`Selected lane: ${lane.lane} (via ${lane.via})\n`);

  // internal-only is refused HERE, before anything is built or run. ADR-0219's data boundary sends an
  // internal-only input to NO driver -- the machine's own CLI included -- so neither surface could run,
  // and starting them would only turn a declaration into two RUN FAILED lines (review W2, measured).
  if (o.classification !== "external-ok") {
    return usage("this diff is internal-only (the default), and the data boundary (ADR-0219) sends internal-only input to no driver, so neither surface can run. Pass --classification external-ok only if this repo's code is public anyway -- arc's is; a venture repo's is not.");
  }
  const ev = evidenceDir(root, lane, o.phase);
  if (ev.error) return usage(ev.error);
  const round = Number(o.round);
  let sha7;
  try { sha7 = git(root, ["rev-parse", "--short=7", "HEAD"]); } catch (e) { return usage(e.message); }

  const trialModel = env.ARC_ATTACK_TRIAL_MODEL || "";
  const lines = [];
  // Two independent facts, never one max(): a failed surface and a deliberately unstarted one. With
  // `worst = max(worst, code)` the logic surface's NOT RUN (7) ran first and a real boundary
  // failure (1) could never lower it -- the outage reported as "not configured" (logic attack L1).
  let anyFailed = false, anyNotRun = false, anyBlocked = false, emptyDiff = false;
  // PREFLIGHT EVERY SURFACE BEFORE RUNNING ANY, but judge each surface on its OWN state. A surface
  // already recorded for this round is kept and skipped, never overwritten and never a reason to
  // refuse the other: refusing the whole round deadlocked a partial one (L2). The same holds for a
  // surface whose round-(K-1) prior is missing or ambiguous: it is blocked, the other still runs (L5).
  const plan = [];
  for (const surface of SURFACES) {
    const name = `attack-${sha7}-r${round}-${surface}.json`;
    const target = join(ev.dir, name);
    const recorded = existsSync(target);
    // A recorded file is TRUSTED ONLY IF IT IS A RESULT. Existence alone let a writer killed
    // mid-write leave a truncated file that read as "attacked" for ever (round-2 attack B8).
    const corrupt = recorded ? recordedProblem(target, surface) : null;
    const skip = recorded || surface !== "logic" ? null
      : o.driver !== "mock" && !trialModel ? "no trial model. Set ARC_ATTACK_TRIAL_MODEL (and ARC_LLM_ENDPOINT, ARC_LLM_API_KEY) to run it (ADR-0226)."
      : null;
    const prior = recorded || skip ? { file: null } : priorFor(ev.dir, round, surface, (sha) => inDiffRange(root, o.base || o.since, sha));
    plan.push({ surface, name, target, recorded, corrupt, skip, prior });
  }
  if (plan.every((p) => p.recorded && !p.corrupt))
    return usage(`round ${round} is already recorded for both surfaces in ${ev.rel} -- evidence is never overwritten; use the next --round`);

  let tmp;
  try { tmp = mkdtempSync(join(tmpdir(), "arc-attack-")); }
  catch (e) { process.stderr.write(`arc-attack: could not create a temp dir (${e.code || e.message})\n`); return 1; }
  try {
    for (const { surface, name, target, recorded, corrupt, skip, prior } of plan) {
      const label = surface.toUpperCase();
      if (recorded && corrupt) {
        lines.push(`${label}: ${join(ev.rel, name)} exists but is not a valid result (${oneLine(corrupt)}) -- left in place, not re-run; inspect or remove it.`);
        anyFailed = true;
        continue;
      }
      if (recorded) {
        lines.push(`${label}: already recorded for round ${round} -> ${join(ev.rel, name)} (kept, not re-run)`);
        continue;
      }
      if (skip) {
        lines.push(`LOGIC: NOT RUN -- ${skip}`);
        anyNotRun = true;
        continue;
      }
      if (prior.error) {
        lines.push(`${label}: NOT RUN -- ${oneLine(prior.error)}`);
        anyBlocked = true;
        continue;
      }

      // Each surface builds its own diff; if HEAD moved between them, the two would attack different
      // code filed under one SHA (review nit). Checked, never assumed.
      let now = null;
      try { now = git(root, ["rev-parse", "--short=7", "HEAD"]); } catch { now = null; }
      if (now !== sha7) {
        lines.push(`${label}: NOT RUN -- HEAD moved from ${sha7} to ${now ?? "(unreadable)"} during the pass; rerun on a still tree`);
        anyFailed = true;
        continue;
      }
      const input = join(tmp, `${surface}.json`);
      const buildArgs = [join(HERE, "build-attack-input.mjs"), ...(o.base ? ["--base", o.base] : ["--since", o.since]),
        "--surface", surface, "--out", input, "--root", root, "--classification", o.classification];
      if (lane.mode === "lane") buildArgs.push("--lane", lane.lane);
      if (prior.file) {
        buildArgs.push("--prior", prior.file);
        // Named on screen: which prior this round attacks the fixes of is a fact the reader must be able to check.
        lines.push(`${label}: round ${round} carries its prior ${relative(root, prior.file).split(sep).join("/")}`);
      }
      const b = spawnSync(process.execPath, buildArgs, { cwd: root, encoding: "utf8", env });
      process.stderr.write(b.stderr || "");
      // Recorded and reported, never an early return: returning here dropped every line already
      // gathered -- a surface written to evidence, a NOT RUN -- from the screen (review W4).
      if (b.status !== 0) {
        if (b.status === 6) emptyDiff = true;
        lines.push(`${label}: INPUT NOT BUILT (build-attack-input exit ${b.status ?? "none"}) -- see the message above`);
        anyFailed = true;
        continue;
      }

      const r = await runSurface({ root, surface, input, driver: o.driver, trialModel, env, label, time, statusFile: o.statusFile });
      const took = ` (took ${elapsed(r.ms)})`;
      if (r.killed) {
        lines.push(`${label}: RUN FAILED -- still running ${elapsed(r.ms)} after it started, past its ${time.minutes}-minute deadline and the grace; ended by the watchdog`);
        anyFailed = true;
        continue;
      }
      if (r.status !== 0) {
        // Every line of a child's stderr is REDACTED and stripped of control characters before it reaches the summary the
        // owner pastes into evidence: a gateway error can echo the credential it was sent (round-2 attack 4010c52 B7). A
        // run that never spawned has no stderr at all (B8).
        const clean = (/** @type {string} */ l) => DENY_RULES.reduce((s, rule) => s.replace(new RegExp(rule.re.source, `${rule.re.flags.replace("g", "")}g`), `[${rule.name} redacted]`), l.replace(/\r$/, "")).replace(/\p{Cc}|\p{Zl}|\p{Zp}/gu, " ");
        const errLines = String(r.stderr ?? "").trim().split("\n").map(clean);
        const tail = errLines.slice(-8).join("\n    ");
        // The CAUSE is arc-run's first own line, and the tail alone cut it: a data-boundary refusal ("a secret matching
        // rule ... appeared in --input") was pushed out by the receipt emitter's worktree warning, and a run refused
        // for a secret read as a bare RUN FAILED (face Phase 06 slice 05). Said first, whenever the tail lacks it.
        // The transcript-destination WARN is not a cause: it led the lines and hid the gateway's refusal. ONLY that WARN
        // is passed over -- another WARN can be the refusal itself (round-2 attack 1d98650 B10).
        const cause = errLines.find((l) => /^arc-run: /.test(l) && !/could not emit run\.completed|^arc-run: WARN .*NO destination is set/.test(l));
        lines.push(`${label}: RUN FAILED (arc-run exit ${r.status ?? "none"}${r.error ? `, ${r.error.message}` : ""})${cause && !errLines.slice(-8).includes(cause) ? `\n    cause: ${cause}` : ""}\n    ${tail}`);
        anyFailed = true;
        continue;
      }
      let doc;
      try { doc = JSON.parse(r.stdout); } catch { doc = null; }
      const wrong = checkAnswer(doc, surface);
      if (wrong) {
        lines.push(`${label}: REFUSED -- ${oneLine(wrong)}. Not written.`);
        anyFailed = true;
        continue;
      }
      const err = writeEvidence(target, doc);
      if (err) {
        lines.push(`${label}: NOT WRITTEN -- ${join(ev.rel, name)} ${err === "EEXIST" ? "appeared while this run was working (another run for the same round?); it was kept" : `could not be written: ${err}`}.`);
        anyFailed = true;
        continue;
      }
      const sum = summarize(surface, doc, join(ev.rel, name));
      sum[0] += took;
      lines.push(...sum);
    }
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); }
    catch (e) { process.stderr.write(`arc-attack: WARN could not remove ${JSON.stringify(tmp)}: ${e.code || e.message}\n`); }
  }

  process.stdout.write(`arc-attack @ ${sha7}, round ${round}${o.driver === "mock" ? " (mock driver)" : ""}\n`);
  for (const l of lines) process.stdout.write(`${l}\n`);
  process.stdout.write("Nothing was fixed or committed by the attacker. Fix them now, in THIS session (ADR-0226 Amendment 1), then --round 2.\n");
  // A failed run outranks a surface that could not start, which outranks one deliberately not started.
  // An empty diff is the first answer: nothing could be attacked at all.
  if (emptyDiff) return 6;
  if (anyFailed) return 1;
  if (anyBlocked) return 2;
  if (anyNotRun) return 7;
  return 0;
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

// An uncaught throw exits with Node's own code and a stack, outside the documented set (L7).
if (isMainModule()) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { process.stderr.write(`arc-attack: unexpected failure: ${e && e.message}\n`); process.exitCode = 1; },
  );
}
