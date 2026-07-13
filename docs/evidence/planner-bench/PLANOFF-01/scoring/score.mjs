#!/usr/bin/env node
/**
 * PLANOFF-01 — cross-arm scoring. Run AFTER every arm has metrics.json + rubric.json.
 *
 *   node scoring/score.mjs            # print the table, write RESULTS.md, append LEDGER.md
 *   node scoring/score.mjs --dry-run  # print only, touch nothing
 *
 * Composite = 0.5 × AUTO(0–100) + 0.5 × RUBRIC(0–100).
 * A-6 efficiency (5 pts) is assigned here because it is a rank, and a rank needs the field.
 *
 * Refuses to produce a verdict from a partial field — a 2-arm "winner" is not a winner.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ARMS = ['arc', 'raw', 'gsd', 'gstack', 'superpowers'];
const WEIGHTS = {
  plan_quality: 20,
  risk_reasoning: 15,
  drift_resistance: 15,
  honesty: 20,
  rework_cost: 10,
  resumability: 10,
  operator_load: 10,
};

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = resolve(HERE, '..');
const ROOT = resolve(BENCH, '..'); // docs/evidence/planner-bench
const DRY = process.argv.includes('--dry-run');

const weightSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (weightSum !== 100) {
  console.error(`✗ rubric weights sum to ${weightSum}, not 100 — fix WEIGHTS or rubric.md.`);
  process.exit(1);
}

const round1 = (n) => Math.round(n * 10) / 10;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* ── load the field ────────────────────────────────────────────────────────── */

const field = [];
const missing = [];
for (const arm of ARMS) {
  const m = join(BENCH, 'runs', arm, 'metrics.json');
  const r = join(BENCH, 'runs', arm, 'rubric.json');
  if (!existsSync(m) || !existsSync(r)) {
    missing.push(`${arm}: ${!existsSync(m) ? 'metrics.json ' : ''}${!existsSync(r) ? 'rubric.json' : ''}`.trim());
    continue;
  }
  field.push({ arm, metrics: readJson(m), rubric: readJson(r) });
}

if (field.length === 0) {
  console.error('✗ no completed arms. Run metrics-collect.mjs first.');
  process.exit(1);
}
if (missing.length) {
  console.error('! incomplete field — these arms are not scored:\n  ' + missing.join('\n  '));
  console.error('  A verdict from a partial field is not a verdict. Printing anyway, but RESULTS is marked PARTIAL.\n');
}

/* ── A-6 efficiency: rank on cost + wall-clock, equal weight ───────────────── */

const rankAsc = (vals) => {
  // returns a map value → 0-based rank, cheapest/fastest first; nulls rank last
  const sorted = [...new Set(vals.filter((v) => typeof v === 'number'))].sort((a, b) => a - b);
  return (v) => (typeof v === 'number' ? sorted.indexOf(v) : sorted.length);
};
const costRank = rankAsc(field.map((f) => f.metrics.raw.cost_usd));
const timeRank = rankAsc(field.map((f) => f.metrics.raw.wall_clock_min));

const effOrder = field
  .map((f) => ({ arm: f.arm, r: costRank(f.metrics.raw.cost_usd) + timeRank(f.metrics.raw.wall_clock_min) }))
  .sort((a, b) => a.r - b.r);
const EFF_PTS = [5, 4, 3, 2, 1];
const efficiency = Object.fromEntries(effOrder.map((e, i) => [e.arm, EFF_PTS[Math.min(i, EFF_PTS.length - 1)]]));

/* ── composites ────────────────────────────────────────────────────────────── */

for (const f of field) {
  for (const k of Object.keys(WEIGHTS)) {
    const v = f.rubric[k];
    if (typeof v !== 'number' || v < 0 || v > 10) {
      console.error(`✗ ${f.arm}/rubric.json: "${k}" must be a number 0–10 (got ${JSON.stringify(v)}).`);
      process.exit(1);
    }
  }
  f.eff = efficiency[f.arm];
  f.auto = round1(f.metrics.auto_without_efficiency + f.eff);
  f.rubricScore = round1(Object.entries(WEIGHTS).reduce((a, [k, w]) => a + (f.rubric[k] / 10) * w, 0));
  f.composite = round1(0.5 * f.auto + 0.5 * f.rubricScore);
}

field.sort((a, b) => b.composite - a.composite);

/* ── output ────────────────────────────────────────────────────────────────── */

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nPLANOFF-01 — composite (${field.length}/5 arms)\n`);
console.log(`  ${pad('arm', 13)}${pad('composite', 11)}${pad('auto', 8)}${pad('rubric', 8)}${pad('accept', 9)}${pad('traps', 7)}${pad('false-done', 11)}cost`);
console.log(`  ${'─'.repeat(74)}`);
for (const f of field) {
  const r = f.metrics.raw;
  console.log(
    `  ${pad(f.arm, 13)}${pad(f.composite, 11)}${pad(f.auto, 8)}${pad(f.rubricScore, 8)}` +
      `${pad(`${r.acceptance_pct}%`, 9)}${pad(`${r.trap_points}/10`, 7)}${pad(r.false_done_claims, 11)}$${r.cost_usd ?? '?'}`,
  );
}

const top = field[0];
const runnerUp = field[1];
const margin = runnerUp ? round1(top.composite - runnerUp.composite) : null;
console.log(`\n  Leader: ${top.arm} (${top.composite})`);
if (margin !== null) {
  console.log(
    margin < 5
      ? `  Margin over ${runnerUp.arm}: ${margin} — INSIDE NOISE. Do not declare a winner; re-run or widen the scope.`
      : `  Margin over ${runnerUp.arm}: ${margin}`,
  );
}
console.log();

if (DRY) process.exit(0);

/* ── RESULTS.md table block (replaces the marked section) ──────────────────── */

const resultsPath = join(BENCH, 'RESULTS.md');
const rows = field
  .map((f) => {
    const r = f.metrics.raw;
    return `| ${f.arm} | **${f.composite}** | ${f.auto} | ${f.rubricScore} | ${r.acceptance_pct}% | ${r.trap_points}/10 | ${r.false_done_claims} | ${r.rework_ratio === null ? 'n/a' : `${Math.round(r.rework_ratio * 100)}%`} | ${r.wall_clock_min ?? '?'} | $${r.cost_usd ?? '?'} |`;
  })
  .join('\n');

const block = [
  '<!-- SCORES:BEGIN (generated by scoring/score.mjs — do not hand-edit) -->',
  `_Generated ${new Date().toISOString()} · ${field.length}/5 arms${missing.length ? ' · **PARTIAL FIELD — not a verdict**' : ''}_`,
  '',
  '| arm | composite | auto | rubric | acceptance | traps | false-done | rework | min | cost |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  rows,
  '',
  margin !== null && margin < 5
    ? `> ⚠️ **${top.arm} leads ${runnerUp.arm} by ${margin} — inside noise.** Not a winner. Re-run, or move to a scope where planning can actually pay off.`
    : `> Leader: **${top.arm}** (${top.composite})${margin !== null ? `, ahead of ${runnerUp.arm} by ${margin}` : ''}.`,
  '<!-- SCORES:END -->',
].join('\n');

if (existsSync(resultsPath)) {
  const cur = readFileSync(resultsPath, 'utf8');
  const re = /<!-- SCORES:BEGIN[\s\S]*?<!-- SCORES:END -->/;
  writeFileSync(resultsPath, re.test(cur) ? cur.replace(re, block) : `${cur.trimEnd()}\n\n${block}\n`);
  console.log(`→ ${resultsPath}`);
} else {
  console.error(`! ${resultsPath} missing — skipped table injection.`);
}

/* ── LEDGER.md — append-only, idempotent ───────────────────────────────────── */

const ledgerPath = join(ROOT, 'LEDGER.md');
if (existsSync(ledgerPath)) {
  const cur = readFileSync(ledgerPath, 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  for (const f of field) {
    if (cur.includes(`| PLANOFF-01 | ${f.arm} |`)) continue; // already recorded
    const one = (f.rubric.notes ?? '').replace(/\|/g, '/').trim() || 'no one-sentence finding written — go write it';
    lines.push(`| ${date} | PLANOFF-01 | ${f.arm} | snip (URL shortener) | ${f.composite} | ${f.metrics.raw.acceptance_pct}% | ${f.metrics.raw.trap_points}/10 | ${one} |`);
  }
  if (lines.length) {
    appendFileSync(ledgerPath, lines.join('\n') + '\n');
    console.log(`→ ${ledgerPath} (+${lines.length} row${lines.length > 1 ? 's' : ''})`);
  } else {
    console.log(`→ ${ledgerPath} (already up to date)`);
  }
} else {
  console.error(`! ${ledgerPath} missing — skipped ledger append.`);
}

console.log(
  '\nNext: read RESULTS.md § Verdict and write it yourself. The table is arithmetic; the verdict is judgement.\n' +
    'Then /arc-bench promote — but only for a pattern you have now seen TWICE.\n',
);
