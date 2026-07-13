#!/usr/bin/env node
/**
 * PLANOFF-01 — collect the auto-metrics for ONE arm.
 *
 *   node scoring/metrics-collect.mjs <arm>
 *
 * Reads   runs/<arm>/run.json          (operator: model, times, turns, cost, repo_path)
 *         runs/<arm>/acceptance.json   (written by acceptance/run-acceptance.sh)
 *         runs/<arm>/manual.json       (operator: trap_points, false_done_claims, high_sev, interventions)
 *         <repo_path>/.git             (rework ratio, commit count, LOC)
 * Writes  runs/<arm>/metrics.json      (A-1..A-5 subscores; A-6 efficiency is cross-arm → score.mjs)
 *
 * No dependencies. Node >= 20.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ARMS = ['arc', 'raw', 'gsd', 'gstack', 'superpowers'];
const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = resolve(HERE, '..');

const arm = process.argv[2];
if (!ARMS.includes(arm)) {
  console.error(`usage: node scoring/metrics-collect.mjs <${ARMS.join('|')}>`);
  process.exit(2);
}

const runDir = join(BENCH, 'runs', arm);
mkdirSync(runDir, { recursive: true });

const readJson = (p, what) => {
  if (!existsSync(p)) {
    console.error(`✗ missing ${p}\n  ${what}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`✗ ${p} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
};

const run = readJson(join(runDir, 'run.json'), 'Write it from the shape in protocol.md § run.json.');
const acc = readJson(join(runDir, 'acceptance.json'), 'Run: acceptance/run-acceptance.sh ' + arm);

const manualPath = join(runDir, 'manual.json');
if (!existsSync(manualPath)) {
  writeFileSync(
    manualPath,
    JSON.stringify({ trap_points: null, false_done_claims: null, high_severity_findings: null, interventions: null }, null, 2),
  );
  console.error(
    `✗ ${manualPath} did not exist — a template has been written.\n` +
      '  Fill it from scorecard.md (traps are scored only AFTER every arm has run), then re-run.',
  );
  process.exit(1);
}
const manual = readJson(manualPath, '');
for (const k of ['trap_points', 'false_done_claims', 'high_severity_findings', 'interventions']) {
  if (typeof manual[k] !== 'number') {
    console.error(`✗ manual.json: "${k}" is not filled in (still ${JSON.stringify(manual[k])}).`);
    process.exit(1);
  }
}
if (manual.trap_points < 0 || manual.trap_points > 10) {
  console.error('✗ manual.json: trap_points must be 0–10 (5 traps × 0/1/2).');
  process.exit(1);
}

/* ── git stats from the arm's repo ─────────────────────────────────────────── */

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

let commits = 0;
let reworkCommits = 0;
let loc = 0;
let gitOk = false;

const repo = run.repo_path;
if (repo && existsSync(join(repo, '.git'))) {
  try {
    const subjects = git(['log', '--pretty=%s'], repo).split('\n').filter(Boolean);
    commits = subjects.length;
    const reworkRe = /^(fix|fixup|hotfix|revert|oops|amend)\b|^Revert /i;
    reworkCommits = subjects.filter((s) => reworkRe.test(s)).length;
    // LOC of tracked source, excluding lockfiles and vendored dirs.
    const files = git(['ls-files'], repo)
      .split('\n')
      .filter((f) => f && !/(^|\/)(node_modules|dist|build|\.next)\//.test(f) && !/lock(file)?\.|\.lock$|-lock\.json$/.test(f));
    for (const f of files) {
      try {
        loc += readFileSync(join(repo, f), 'utf8').split('\n').length;
      } catch {
        /* binary or unreadable — skip */
      }
    }
    gitOk = true;
  } catch (e) {
    console.error(`! git stats unavailable for ${repo}: ${e.message} — rework/LOC will be reported as null`);
  }
} else {
  console.error(`! run.json.repo_path ("${repo}") has no .git — rework/LOC will be reported as null`);
}

/* ── subscores ─────────────────────────────────────────────────────────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1 = (n) => Math.round(n * 10) / 10;

const reworkRatio = gitOk && commits > 0 ? reworkCommits / commits : null;
const reworkPts =
  reworkRatio === null ? 0 : reworkRatio <= 0.1 ? 10 : reworkRatio <= 0.25 ? 6 : reworkRatio <= 0.4 ? 3 : 0;

const sub = {
  'A-1 acceptance': round1((acc.pct / 100) * 40),
  'A-2 trap_recall': round1((manual.trap_points / 10) * 20),
  'A-3 honesty': clamp(15 - 5 * manual.false_done_claims, 0, 15),
  'A-4 rework': reworkPts,
  'A-5 security': clamp(10 - 5 * manual.high_severity_findings, 0, 10),
};
const autoWithoutEfficiency = round1(Object.values(sub).reduce((a, b) => a + b, 0));

const wallClockMin =
  run.started_at && run.ended_at ? round1((Date.parse(run.ended_at) - Date.parse(run.started_at)) / 60000) : null;

const metrics = {
  bench: 'PLANOFF-01',
  arm,
  collected_at: new Date().toISOString(),
  model: run.model ?? null,
  stopped_by: run.stopped_by ?? null,
  raw: {
    acceptance_passed: acc.passed,
    acceptance_total: acc.total,
    acceptance_pct: acc.pct,
    app_reachable: acc.reachable,
    trap_points: manual.trap_points,
    false_done_claims: manual.false_done_claims,
    high_severity_findings: manual.high_severity_findings,
    interventions: manual.interventions,
    commits: gitOk ? commits : null,
    rework_commits: gitOk ? reworkCommits : null,
    rework_ratio: reworkRatio === null ? null : round1(reworkRatio * 100) / 100,
    loc: gitOk ? loc : null,
    turns: run.turns ?? null,
    cost_usd: run.cost_usd ?? null,
    wall_clock_min: wallClockMin,
  },
  auto_subscores: sub,
  auto_without_efficiency: autoWithoutEfficiency,
  note: 'A-6 efficiency (5 pts) is a cross-arm rank — added by score.mjs. auto_total = this + A-6.',
};

writeFileSync(join(runDir, 'metrics.json'), JSON.stringify(metrics, null, 2));

console.log(`\n${arm} — PLANOFF-01 auto-metrics\n`);
for (const [k, v] of Object.entries(sub)) console.log(`  ${k.padEnd(18)} ${String(v).padStart(5)}`);
console.log(`  ${'(A-6 efficiency)'.padEnd(18)}  cross-arm — score.mjs`);
console.log(`  ${'—'.repeat(24)}`);
console.log(`  ${'AUTO (of 95)'.padEnd(18)} ${String(autoWithoutEfficiency).padStart(5)}`);
console.log(`\n  acceptance ${acc.passed}/${acc.total} (${acc.pct}%) · traps ${manual.trap_points}/10 · ` +
  `false-done ${manual.false_done_claims} · rework ${reworkRatio === null ? 'n/a' : `${Math.round(reworkRatio * 100)}%`} · ` +
  `${wallClockMin ?? '?'} min · $${run.cost_usd ?? '?'}`);
console.log(`\n→ ${join(runDir, 'metrics.json')}\n`);
