#!/usr/bin/env node
// shard-tests.mjs -- split tests/*.bats into N balanced groups for the CI matrix.
//
// WHY THIS EXISTS. arc-ci's windows leg ran 22.5 minutes against 2 on every ubuntu leg. All
// legs run in parallel, so windows alone set the wall clock. Measured per-file on a real
// windows runner (2026-07-30, run 30569500717): the cost is SPREAD, not concentrated -- the
// top 3 files are 32% and the top 10 are 64%. Per test it is 2.80s on windows against 0.25s
// on ubuntu, because every bats `run` spawns a process and windows process creation is an
// order of magnitude dearer. There is no slow file to fix; the honest fix is to split.
//
// Balancing is by MEASURED SECONDS, never by file count: design-steel-thread.bats alone costs
// as much as the 26 cheapest files together, so an even file-count split would leave one shard
// carrying most of the run and change nothing.
//
// Lives in .github/ rather than .claude/ on purpose: this is arc's OWN ci tooling, not a
// product file. Anything under .claude/ is synced into consumer projects and must appear in a
// product manifest, and a test sharder for a suite those projects do not have belongs in
// neither.
//
//   shard-tests.mjs --index <i> --total <n>   # print this shard's files, one per line
//   shard-tests.mjs --plan  --total <n>       # print the whole plan with per-shard totals
//
// Exit: 0 ok | 1 bad args, missing tests dir, or a file that would land in no shard.
//
// THE FAILURE MODE THIS GUARDS. A sharder that silently drops a file turns a green CI into a
// lie -- the suite "passes" having never run part of itself. So: every discovered file is
// assigned exactly once, asserted below, and `tests/shard-timings.json` is advisory only. A
// file missing from it is not skipped; it takes `_default_weight` and is still placed.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TESTS = join(ROOT, "tests");
const TIMINGS = join(TESTS, "shard-timings.json");

const die = (msg) => { process.stderr.write(`shard-tests: ${msg}\n`); process.exit(1); };

// ---- args -------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const wantPlan = argv.includes("--plan");
const total = Number(flag("total"));
const index = Number(flag("index"));

if (!Number.isInteger(total) || total < 1) die("--total must be a positive integer");
if (!wantPlan && (!Number.isInteger(index) || index < 1 || index > total))
  die(`--index must be an integer in 1..${total} (1-based, matching a CI matrix)`);

// ---- discover ---------------------------------------------------------------------------
if (!existsSync(TESTS)) die(`no tests dir at ${TESTS}`);
const files = readdirSync(TESTS).filter((f) => f.endsWith(".bats")).sort();
if (files.length === 0) die("no *.bats files found -- refusing to emit empty shards");

// Timings are advisory. A malformed or absent file must not stop CI from running the suite;
// it only costs balance, and an unbalanced run is slower, never wrong.
let weights = {};
let fallback = 16;
try {
  const t = JSON.parse(readFileSync(TIMINGS, "utf8"));
  weights = t.timings ?? {};
  if (Number.isFinite(t._default_weight)) fallback = t._default_weight;
} catch {
  process.stderr.write(`shard-tests: no usable ${TIMINGS} -- balancing every file equally\n`);
}

// ---- pack -------------------------------------------------------------------------------
// Longest-processing-time first: sort descending, drop each file into the lightest shard.
// Ties break on filename so the assignment is deterministic across runs and machines -- two
// runners computing different shards would double-run some files and skip others.
const items = files
  .map((f) => ({ f, w: Number.isFinite(weights[f]) ? weights[f] : fallback }))
  .sort((a, b) => (b.w - a.w) || a.f.localeCompare(b.f));

const bins = Array.from({ length: total }, () => ({ files: [], sum: 0 }));
for (const it of items) {
  let best = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i].sum < bins[best].sum) best = i;
  bins[best].files.push(it.f);
  bins[best].sum += it.w;
}

// ---- the guard that matters -------------------------------------------------------------
// A file in no shard is never run and nobody finds out from a green tick.
const placed = bins.flatMap((b) => b.files);
if (placed.length !== files.length) die(`packed ${placed.length} files but discovered ${files.length}`);
const seen = new Set(placed);
if (seen.size !== files.length) die("a file was placed in more than one shard");
for (const f of files) if (!seen.has(f)) die(`file "${f}" landed in no shard`);

// ---- output -----------------------------------------------------------------------------
if (wantPlan) {
  const sums = bins.map((b) => b.sum);
  for (const [i, b] of bins.entries())
    process.stdout.write(`shard ${i + 1}/${total}  ${String(b.sum).padStart(5)}s  ${b.files.length} file(s)  ${b.files.join(" ")}\n`);
  process.stdout.write(
    `total ${sums.reduce((a, c) => a + c, 0)}s across ${files.length} files · ` +
    `heaviest shard ${Math.max(...sums)}s · lightest ${Math.min(...sums)}s\n`);
} else {
  for (const f of bins[index - 1].files) process.stdout.write(`tests/${f}\n`);
}
