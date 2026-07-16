#!/usr/bin/env node
/**
 * council-calibrate — score the arc-council's saved verdicts against their recorded outcomes.
 * Zero deps. Exit 0 = table rendered (or nothing to score); exit 1 = malformed outcome / bad args.
 *
 * Modes:
 *   node .claude/scripts/council-calibrate.mjs [dir]
 *     Scoring table: per-confidence-bucket hit-rate + an overall Brier score. Default dir:
 *     docs/council/sessions. (ADR-0009 buckets: High=0.85, Medium=0.65, Low=0.5.)
 *   node .claude/scripts/council-calibrate.mjs --overdue [dir] [--today YYYY-MM-DD]
 *     List sessions that still NEED an outcome recorded: their latest Review-by is before today AND
 *     they have no terminal (HIT/MISS) outcome yet. Used by /arc-council review.
 *
 * Append-only model (ADR-0012): a session may carry MORE THAN ONE `## OUTCOME` / `Review-by:` (a
 * re-review after UNRESOLVED appends a fresh outcome + date). The LAST of each is authoritative.
 *
 * Outcome grammar: the LAST `## OUTCOME`'s `RESULT:` decides —
 *   - HIT  -> scored, outcome 1        · MISS -> scored, outcome 0
 *   - UNRESOLVED, or DECISION: WAIT    -> counted separately, excluded from scoring
 *   - no `## OUTCOME` section           -> pending review, skipped (WARN)
 *   - `## OUTCOME` present, RESULT missing/free-text -> MALFORMED, hard error (exit 1)
 *   - no CONFIDENCE (but a terminal outcome) -> can't bucket, skipped (WARN)
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUCKETS = { High: 0.85, Medium: 0.65, Low: 0.5 };
const titleCase = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

function isValidISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const argv = process.argv.slice(2);
const overdue = argv.includes("--overdue");
const todayIdx = argv.indexOf("--today");
const todayArg = todayIdx >= 0 ? argv[todayIdx + 1] : null;
if (todayIdx >= 0 && (!todayArg || todayArg.startsWith("--"))) {
  console.error(`council-calibrate: --today needs a YYYY-MM-DD value`);
  process.exit(1);
}
const todayValIdx = todayIdx >= 0 ? todayIdx + 1 : -1;
const dir = argv.find((a, i) => !a.startsWith("--") && i !== todayValIdx) || "docs/council/sessions";

function sessionFiles(d) {
  if (!existsSync(d) || !statSync(d).isDirectory()) return null;
  return readdirSync(d)
    .filter((f) => /\.md$/i.test(f) && f.toLowerCase() !== "readme.md")
    .map((f) => join(d, f))
    .filter((p) => { try { return statSync(p).isFile(); } catch { return false; } })
    .sort();
}

const files = sessionFiles(dir);
if (files === null) {
  console.log(`council-calibrate: no sessions directory at "${dir}" — nothing to score yet.`);
  process.exit(0);
}
if (files.length === 0) {
  console.log(`council-calibrate: "${dir}" has no session files yet — nothing to score.`);
  process.exit(0);
}

const confOf = (t) => { const m = t.match(/^CONFIDENCE:\s*(High|Medium|Low)\b/im); return m ? titleCase(m[1]) : null; };
const decisionOf = (t) => (t.match(/^DECISION:\s*(YES|NO|CONDITIONAL|WAIT)\b/im) || [])[1];
const reviewByLast = (t) => { const all = [...t.matchAll(/^Review-by:\s*(.+?)\s*$/gim)]; return all.length ? all[all.length - 1][1] : null; };
const outcomeSections = (t) => [...t.matchAll(/##\s*OUTCOME([\s\S]*?)(?=\n##\s|$)/gi)].map((m) => m[1]);
const resultOf = (sec) => ((sec.match(/^RESULT:\s*(HIT|MISS|UNRESOLVED)\s*$/im) || [])[1] || "").toUpperCase();

// ---- overdue mode ----
if (overdue) {
  const today = todayArg || new Date().toISOString().slice(0, 10);
  if (!isValidISODate(today)) {
    console.error(`council-calibrate: --today "${today}" is not a valid YYYY-MM-DD date`);
    process.exit(1);
  }
  const od = [];
  const warns = [];
  for (const f of files) {
    const t = readFileSync(f, "utf8");
    const secs = outcomeSections(t);
    const lastRes = secs.length ? resultOf(secs[secs.length - 1]) : "";
    if (lastRes === "HIT" || lastRes === "MISS") continue; // already reviewed and closed
    const rb = reviewByLast(t);
    if (rb && !isValidISODate(rb)) { warns.push(`${f}: Review-by "${rb}" is not a valid date — cannot schedule`); continue; }
    if (rb && rb < today) od.push({ f, rb });
  }
  if (od.length === 0) console.log(`council-calibrate: no sessions are overdue for review (as of ${today}).`);
  else {
    console.log(`council-calibrate: ${od.length} session(s) overdue for review (as of ${today}):`);
    od.sort((a, b) => a.rb.localeCompare(b.rb)).forEach((o) => console.log(`  ${o.rb}  ${o.f}`));
  }
  for (const w of warns) console.log(`WARN  ${w}`);
  process.exit(0);
}

// ---- scoring mode ----
const stats = { High: { n: 0, hits: 0 }, Medium: { n: 0, hits: 0 }, Low: { n: 0, hits: 0 } };
const errors = [];
const warns = [];
let scored = 0, pending = 0, excluded = 0, skipped = 0, brierSum = 0;

for (const f of files) {
  const t = readFileSync(f, "utf8");
  const secs = outcomeSections(t);
  if (secs.length === 0) { warns.push(`${f}: no ## OUTCOME yet — pending review`); pending++; continue; }
  const res = resultOf(secs[secs.length - 1]); // the LAST outcome is authoritative (append-only)
  if (!res) { errors.push(`${f}: ## OUTCOME present but no valid "RESULT: HIT|MISS|UNRESOLVED" line — malformed outcome`); continue; }
  if (res === "UNRESOLVED" || decisionOf(t) === "WAIT") { excluded++; continue; }
  const c = confOf(t);
  if (!c) { warns.push(`${f}: no CONFIDENCE line — can't bucket, skipped`); skipped++; continue; }
  const outcome = res === "HIT" ? 1 : 0;
  stats[c].n++;
  if (outcome) stats[c].hits++;
  brierSum += (BUCKETS[c] - outcome) ** 2;
  scored++;
}

if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`);
  console.error(`\ncouncil-calibrate: ${errors.length} malformed outcome(s) — a recorded outcome must be HIT, MISS, or UNRESOLVED. Fix or remove, then re-run.`);
  process.exit(1);
}

console.log(`arc-council calibration — ${dir}`);
console.log(`scored: ${scored} · pending: ${pending} · excluded (WAIT/UNRESOLVED): ${excluded} · skipped: ${skipped}\n`);
console.log(`bucket   prob   n   hits   hit-rate`);
for (const b of ["High", "Medium", "Low"]) {
  const s = stats[b];
  const rate = s.n ? (s.hits / s.n).toFixed(2) : "—";
  console.log(`${b.padEnd(7)} ${BUCKETS[b].toFixed(2)}  ${String(s.n).padEnd(2)}  ${String(s.hits).padEnd(4)}  ${rate}`);
}
console.log(`\nBrier score (lower is better): ${scored ? (brierSum / scored).toFixed(4) : "n/a (0 scored)"}`);
for (const w of warns) console.log(`WARN  ${w}`);
process.exit(0);
