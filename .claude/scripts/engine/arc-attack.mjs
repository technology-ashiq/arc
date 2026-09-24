#!/usr/bin/env node
/**
 * arc-attack.mjs -- the PR loop's two-surface attacker pass, as governed engine work (ADR-0226).
 *
 *   node .claude/scripts/engine/arc-attack.mjs (--base REF | --since SHA) [--lane NAME]
 *        [--phase NN] [--round K] [--classification internal-only|external-ok] [--driver mock]
 *        [--root PATH]
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
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { laneHeader, renderHuman, resolveLane } from "../core/lane-resolve.mjs";

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
  const o = { base: null, since: null, lane: "", laneGiven: false, laneDup: false, phase: null, round: "1", driver: null, root: null, classification: "internal-only" };
  const FLAGS = { "--base": "base", "--since": "since", "--lane": "lane", "--phase": "phase", "--round": "round", "--driver": "driver", "--root": "root", "--classification": "classification" };
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
function priorFor(dir, round, surface, inRange = () => false) {
  if (round === 1) return { file: null };
  const want = new RegExp(`^attack-([0-9a-f]{7,40})-r${round - 1}-${surface}\\.json$`);
  const hits = existsSync(dir) ? readdirSync(dir).filter((f) => want.test(f)).sort() : [];
  const inThisDiff = hits.length > 1 ? hits.filter((f) => inRange(/** @type {RegExpExecArray} */ (want.exec(f))[1])) : hits;
  if (inThisDiff.length !== 1)
    return { error: `round ${round} needs exactly one round-${round - 1} ${surface} result in ${dir}${hits.length > 1 ? " for this diff's range" : ""}; found ${hits.length}${hits.length ? `: ${hits.join(", ")}` : ""}` };
  return { file: join(dir, inThisDiff[0]) };
}

/** Is `sha` a commit of the range (ref..HEAD] in `root`? False on any git refusal -- a guess is never a prior. */
function inDiffRange(root, ref, sha) {
  const anc = (a, b) => spawnSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: root, encoding: "utf8" }).status === 0;
  return anc(sha, "HEAD") && !anc(sha, ref);
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

function runSurface({ root, surface, input, driver, trialModel, env }) {
  const args = [join(HERE, "arc-run.mjs"), "--process", "attack-diff", "--root", root, "--input", `@${input}`];
  const childEnv = { ...env };
  if (driver === "mock") { args.push("--driver", "mock"); childEnv.ARC_MOCK_FIXTURE = surface; }
  else if (surface === "logic") args.push("--driver", "generic-api", "--trial-model", trialModel);
  else args.push("--driver", "auto");
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", env: childEnv, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error };
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

export function main(argv, env = process.env) {
  const parsed = parseArgs(argv);
  if (parsed.error) return usage(parsed.error);
  const o = parsed.opts;
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
      if (prior.file) buildArgs.push("--prior", prior.file);
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

      const r = runSurface({ root, surface, input, driver: o.driver, trialModel, env });
      if (r.status !== 0) {
        const tail = r.stderr.trim().split("\n").slice(-8).join("\n    ");
        lines.push(`${label}: RUN FAILED (arc-run exit ${r.status ?? "none"}${r.error ? `, ${r.error.message}` : ""})\n    ${tail}`);
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
      lines.push(...summarize(surface, doc, join(ev.rel, name)));
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
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { process.stderr.write(`arc-attack: unexpected failure: ${e && e.message}\n`); process.exitCode = 1; }
}
