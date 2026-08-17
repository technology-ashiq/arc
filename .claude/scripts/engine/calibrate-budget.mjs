#!/usr/bin/env node
/**
 * calibrate-budget.mjs -- derive a class's wall-clock budget FROM LANDED RECEIPTS (REQ-05).
 *
 * WHY THIS EXISTS AS A SCRIPT RATHER THAN A PARAGRAPH. The criterion is "three runs at a
 * deliberately generous wall-clock, their durations recorded, and the class budget derived FROM
 * THOSE RECEIPTS. A budget written before the receipts exist is a guess and is not accepted here."
 * A derivation nobody can re-run is a number somebody wrote down -- indistinguishable from the
 * guess the clause forbids the moment the receipts move. This reads the spine and shows its work.
 *
 * IT PROPOSES, IT DOES NOT WRITE. The output is a number and the arithmetic behind it; putting it
 * into a router row is a reviewed diff, like every other routing change (ADR-0069 b1).
 *
 * THE RULE IT APPLIES, stated so it can be argued with rather than reverse-engineered:
 *
 *     budget = ceil( (slowest observed run * 1.5) / 60s )   minutes, floor 1
 *
 * The MAXIMUM, not the mean. A budget set from an average declines the slow half of a distribution
 * whose slow half is the interesting half -- and this runtime's own measurements span 32s (warm) to
 * 400s (cold boot), which is not a distribution a mean describes. The 1.5x headroom is for the
 * ladder: ADR-0204 permits one same-tier retry, and a budget that fits exactly one attempt turns
 * every retry into a budget decline.
 *
 * ABSENT IS ABSENT. Receipts with no `duration_ms` are COUNTED AND NAMED rather than skipped, and
 * the tool refuses to derive from fewer than the floor. A silently-shortened sample is how a
 * measured table starts lying (retro-log 2026-08-03: six files rode a 16s default against real
 * costs up to 123s, because a missing entry is a default rather than an error).
 *
 * Usage: calibrate-budget.mjs --process NAME [--driver NAME] [--min-runs 3] [--spine PATH]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback = "") => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const processName = flag("--process");
const driverName = flag("--driver");
const minRuns = Number(flag("--min-runs", "3"));
const spineRoot = flag("--spine", process.env.ARC_SPINE_ROOT || ".claude/state/hq");

if (!processName) {
  process.stderr.write("calibrate-budget: --process NAME is required\n");
  process.exit(2);
}

const eventsDir = join(spineRoot, "events");
let files;
try {
  files = readdirSync(eventsDir).filter((f) => f.endsWith(".jsonl")).sort();
} catch (e) {
  process.stderr.write(`calibrate-budget: cannot read ${eventsDir}: ${e.code || e.message}\n`);
  process.stderr.write("  A worktree has its own gitignored spine. Run this from the main clone.\n");
  process.exit(1);
}

const runs = [];
const noDuration = [];
// A RUN THAT NEVER SPAWNED A DRIVER IS NOT A DISPATCH, and its duration is arc-run's own startup.
// A tenure refusal, a boundary refusal or a spent-budget decline all carry a real `duration_ms` --
// correctly, because arc-run did observe that time -- but folding a 2 ms refusal into a sample of
// 300-second dispatches drags the arithmetic toward a number no dispatch will ever meet. Excluded
// by `attempts`, and COUNTED so the exclusion is visible rather than silent.
const neverDispatched = [];
for (const f of files) {
  for (const line of readFileSync(join(eventsDir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.kind !== "run.completed") continue;
    const p = e.payload || {};
    if (p.process !== processName) continue;
    if (driverName && p.driver !== driverName) continue;
    if (typeof p.duration_ms !== "number" || p.duration_ms < 0) { noDuration.push(e.id); continue; }
    if (p.attempts === 0) { neverDispatched.push(`${e.id} (${p.reason || e.outcome})`); continue; }
    runs.push({ id: e.id, ms: p.duration_ms, outcome: e.outcome, reason: p.reason || "", runtime: p.runtime || "" });
  }
}

const out = [];
out.push(`process        : ${processName}${driverName ? `  (driver ${driverName})` : ""}`);
out.push(`spine          : ${eventsDir}`);
out.push(`runs WITH a duration    : ${runs.length}`);
out.push(`runs WITHOUT one, named : ${noDuration.length}${noDuration.length ? ` -> ${noDuration.join(", ")}` : ""}`);
out.push(`refusals that never spawned a driver, EXCLUDED and named : ${neverDispatched.length}${neverDispatched.length ? ` -> ${neverDispatched.join(", ")}` : ""}`);

if (runs.length === 0) {
  out.push("");
  out.push("NO DERIVATION: no receipt carries a duration. A budget written now would be the guess REQ-05 forbids.");
  process.stdout.write(`${out.join("\n")}\n`);
  process.exit(1);
}

runs.sort((a, b) => a.ms - b.ms);
out.push("");
for (const r of runs) {
  out.push(`  ${String(r.ms).padStart(7)} ms  ${r.outcome}${r.reason ? `/${r.reason}` : ""}  ${r.id}`);
}

const slowest = runs[runs.length - 1].ms;
const budgetMin = Math.max(1, Math.ceil((slowest * 1.5) / 60_000));

out.push("");
out.push(`slowest observed : ${slowest} ms`);
out.push(`x1.5 for the ladder's one retry : ${Math.round(slowest * 1.5)} ms`);
out.push(`DERIVED BUDGET   : min=${budgetMin}`);

if (runs.length < minRuns) {
  out.push("");
  out.push(`NOT ACCEPTED: ${runs.length} run(s) with a duration, floor is ${minRuns}.`);
  out.push("The number above is arithmetic, not a calibration. Run more dispatches.");
  process.stdout.write(`${out.join("\n")}\n`);
  process.exit(1);
}

out.push("");
out.push(`Derived from ${runs.length} receipts. Putting it in engine/router.yaml is a reviewed diff (ADR-0069 b1).`);
process.stdout.write(`${out.join("\n")}\n`);
