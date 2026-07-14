#!/usr/bin/env node
/**
 * council-lint — gate for the arc-council deliverable artifacts + rendered verdicts.
 * Zero deps. Exit 0 = pass; exit 1 = named failures.
 *
 * Two modes:
 *   node .claude/scripts/council-lint.mjs [repo-root]
 *     Static — the /arc-council command + the core member agents exist with valid frontmatter.
 *   node .claude/scripts/council-lint.mjs --verdict <file>
 *     Verdict — POINT-ID cross-reference: every [Pn] cited in KEY REASONS/DISSENT must be rated
 *     Supported/Plausible in the verifier's ratings, and the verifier must have contested >=1 point
 *     (a run where 0 points are Weak/Contested is a rubber-stamp signal). (ADR-0007)
 *
 * Roster grows per phase: Phase 0 = advocate/skeptic/neutral; Phase 1 adds verifier;
 * Phase 3 adds researcher + the 7 domain experts.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const vIdx = args.indexOf("--verdict");
const verdictFile = vIdx >= 0 ? args[vIdx + 1] : null;
const root = args.find((a, i) => !a.startsWith("--") && i !== vIdx + 1) || ".";

const failures = [];
const fail = (msg) => failures.push(msg);

function report() {
  if (failures.length) {
    console.error(`council-lint: ${failures.length} check(s) FAILED\n`);
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error("\nFix and rerun.");
    process.exit(1);
  }
  console.log("council-lint: all checks passed ✔");
  process.exit(0);
}

// minimal YAML-frontmatter reader (key: value between the first --- fences)
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) fm[mm[1].toLowerCase()] = mm[2].trim();
  }
  return fm;
}

// ------------------------------------------------------------------ verdict mode
if (verdictFile) {
  if (!existsSync(verdictFile)) {
    fail(`verdict file not found: ${verdictFile}`);
    report();
  }
  const text = readFileSync(verdictFile, "utf8");

  // verifier ratings: parse the "## VERIFIER RATINGS" section for `Pn: <rating>` lines
  const rm = text.match(/##\s*VERIFIER RATINGS([\s\S]*?)(?=\n##\s|$)/i);
  const ratings = {};
  if (rm)
    for (const mm of rm[1].matchAll(/\b([A-Z]{1,2}\d+)\s*[:\-–]\s*(Supported|Plausible|Weak|Contested)\b/gi))
      ratings[mm[1].toUpperCase()] = mm[2][0].toUpperCase() + mm[2].slice(1).toLowerCase();
  const ratedIds = Object.keys(ratings);
  if (ratedIds.length === 0)
    fail(`${verdictFile}: no "## VERIFIER RATINGS" section with \`Pn: <Supported|Plausible|Weak|Contested>\` lines`);

  // rubber-stamp guard: the verifier must have contested at least one point
  const contested = ratedIds.filter((id) => /^(Weak|Contested)$/.test(ratings[id]));
  if (ratedIds.length > 0 && contested.length === 0)
    fail(`${verdictFile}: verifier contested nothing — rated 0 of ${ratedIds.length} points Weak/Contested (rubber-stamp signal)`);

  // cross-reference: every [Pn] cited in the verdict must be rated Supported/Plausible
  const cited = [...new Set([...text.matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase()))];
  if (cited.length === 0) fail(`${verdictFile}: no KEY REASON/DISSENT cites a [Pn] POINT-ID`);
  for (const id of cited) {
    if (!ratings[id]) fail(`${verdictFile}: cites unrated point ${id} — not in VERIFIER RATINGS`);
    else if (!/^(Supported|Plausible)$/.test(ratings[id]))
      fail(`${verdictFile}: cites ${id} rated ${ratings[id]} — only Supported/Plausible may ground a KEY REASON or DISSENT`);
  }
  report();
}

// ------------------------------------------------------------------ static mode
const read = (p) => readFileSync(join(root, p), "utf8");
const exists = (p) => existsSync(join(root, p));

const CMD = ".claude/commands/arc-council.md";
if (!exists(CMD)) fail(`${CMD} missing — build the arc-council command`);
else {
  const fm = frontmatter(read(CMD));
  if (!fm) fail(`${CMD}: no YAML frontmatter`);
  else
    for (const k of ["description", "argument-hint", "allowed-tools"])
      if (!fm[k]) fail(`${CMD}: frontmatter missing "${k}"`);
}

const CORE_AGENTS = ["council-advocate", "council-skeptic", "council-neutral", "council-verifier"];
for (const name of CORE_AGENTS) {
  const p = `.claude/agents/${name}.md`;
  if (!exists(p)) {
    fail(`${name} missing (${p})`);
    continue;
  }
  const fm = frontmatter(read(p));
  if (!fm) {
    fail(`${p}: no YAML frontmatter`);
    continue;
  }
  for (const k of ["name", "description", "tools", "model"])
    if (!fm[k]) fail(`${p}: frontmatter missing "${k}"`);
  if (fm.name && fm.name !== name)
    fail(`${p}: frontmatter name "${fm.name}" != filename "${name}"`);
}

report();
