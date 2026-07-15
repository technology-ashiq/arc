#!/usr/bin/env node
/**
 * council-lint — gate for the arc-council deliverable artifacts, verdicts, and evidence briefs.
 * Zero deps. Exit 0 = pass; exit 1 = named failures.
 *
 * Modes:
 *   node .claude/scripts/council-lint.mjs [repo-root]
 *     Static — the /arc-council command + the core member agents exist with valid frontmatter.
 *   node .claude/scripts/council-lint.mjs --verdict <file>
 *     Verdict — POINT-ID cross-reference: every [Pn] cited in KEY REASONS/DISSENT must be rated
 *     Supported/Plausible in the verifier's ratings, and the verifier must have contested >=1 point. (ADR-0007)
 *   node .claude/scripts/council-lint.mjs --brief <file>
 *     Brief — a deep Evidence Brief needs >=3 facts, each with a confidence label; in a `live` brief
 *     each High/Med fact needs >=2 independent source URLs or an explicit low-confidence mark. (REQ-04, ADR-0003)
 *
 * Roster grows per phase: Phase 0 = advocate/skeptic/neutral; Phase 1 adds verifier; Phase 2 adds
 * researcher; Phase 3 adds the 7 domain experts.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flagVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const verdictFile = flagVal("--verdict");
const briefFile = flagVal("--brief");
const consumed = new Set();
for (const f of ["--verdict", "--brief"]) {
  const i = args.indexOf(f);
  if (i >= 0) consumed.add(i), consumed.add(i + 1);
}
const root = args.find((a, i) => !a.startsWith("--") && !consumed.has(i)) || ".";

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
  const raw = readFileSync(verdictFile, "utf8");
  // Strip fenced ``` code blocks so an illustrative/template fence can't satisfy the line checks —
  // a real saved verdict is never fenced (session files carry the sections as plain markdown).
  const text = raw.replace(/```[\s\S]*?```/g, "\n");

  const rm = text.match(/##\s*VERIFIER RATINGS([\s\S]*?)(?=\n##\s|$)/i);
  const ratings = {};
  if (rm)
    for (const mm of rm[1].matchAll(/\b([A-Z]{1,2}\d+)\s*[:\-–]\s*(Supported|Plausible|Weak|Contested)\b/gi))
      ratings[mm[1].toUpperCase()] = mm[2][0].toUpperCase() + mm[2].slice(1).toLowerCase();
  const ratedIds = Object.keys(ratings);
  if (ratedIds.length === 0)
    fail(`${verdictFile}: no "## VERIFIER RATINGS" section with \`Pn: <Supported|Plausible|Weak|Contested>\` lines`);

  // no-rubber-stamp: the verifier must have contested >=1 point (0 Weak/Contested = rubber-stamp).
  // (The ADR-0008 REBUTTAL LOG first-pass acceptance path lands in phase-2 with its own fixtures.)
  const contested = ratedIds.filter((id) => /^(Weak|Contested)$/.test(ratings[id]));
  if (ratedIds.length > 0 && contested.length === 0)
    fail(`${verdictFile}: verifier contested nothing — rated 0 of ${ratedIds.length} points Weak/Contested (rubber-stamp signal)`);

  // v2 REQ-01 (decision core): EXACTLY ONE filled DECISION line and ONE filled CONFIDENCE line — an
  // unfilled template placeholder ("DECISION: YES | NO | ...") or a decoy second line is rejected.
  const decLines = [...text.matchAll(/^[ \t]*DECISION:.*$/gim)].map((m) => m[0]);
  let decision = null;
  if (decLines.length === 0) fail(`${verdictFile}: no "DECISION:" line (decision-core check)`);
  else if (decLines.length > 1) fail(`${verdictFile}: ${decLines.length} DECISION: lines — a verdict commits to exactly one (decision-core check)`);
  else {
    const m = decLines[0].match(/^[ \t]*DECISION:\s*(YES|NO|CONDITIONAL|WAIT)\s*$/i);
    if (!m) fail(`${verdictFile}: DECISION: line is unfilled or invalid — must be exactly one of YES|NO|CONDITIONAL|WAIT (decision-core check)`);
    else decision = m[1].toUpperCase();
  }
  const confLines = [...text.matchAll(/^[ \t]*CONFIDENCE:.*$/gim)].map((m) => m[0]);
  let confidence = null;
  if (confLines.length === 0) fail(`${verdictFile}: no "CONFIDENCE:" line (decision-core check)`);
  else if (confLines.length > 1) fail(`${verdictFile}: ${confLines.length} CONFIDENCE: lines — exactly one (decision-core check)`);
  else {
    const m = confLines[0].match(/^[ \t]*CONFIDENCE:\s*(High|Medium|Low)\s*$/i);
    if (!m) fail(`${verdictFile}: CONFIDENCE: line is unfilled or invalid — must be exactly one of High|Medium|Low (decision-core check)`);
    else confidence = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  }

  // v2 REQ-02 (model-knowledge discipline): a High claim requires an explicit "Research mode: live"
  // line. Any other or absent mode (offline / model-knowledge / model knowledge / unstated) caps at
  // Medium — so no synonym, typo, or omission of the mode token can smuggle an offline High through.
  const isLive = /^[ \t]*Research mode:\s*live\s*$/im.test(text);
  if (confidence === "High" && !isLive)
    fail(`${verdictFile}: CONFIDENCE: High without an explicit "Research mode: live" line — an offline or unstated-mode run is capped at Medium (model-knowledge discipline)`);

  // v2 REQ-03 citation rating: every [Pn] cited OUTSIDE ## UNRESOLVED / ## DISPUTED must be
  // Supported/Plausible. Scanning the whole verdict MINUS those two sections (rather than trying to
  // bound KEY REASONS/DISSENT) is robust to section-boundary games — a Weak cite anywhere it could
  // ground the decision is caught, while a Contested pair may still be shown under ## UNRESOLVED.
  const citable = text
    .replace(/##\s*UNRESOLVED[\s\S]*?(?=\n##\s|$)/i, "")
    .replace(/##\s*DISPUTED[\s\S]*?(?=\n##\s|$)/i, "");
  const citedOutside = [...new Set([...citable.matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase()))];
  for (const id of citedOutside) {
    if (!ratings[id]) fail(`${verdictFile}: cites unrated point ${id} outside UNRESOLVED — not in VERIFIER RATINGS`);
    else if (!/^(Supported|Plausible)$/.test(ratings[id]))
      fail(`${verdictFile}: cites ${id} rated ${ratings[id]} — only Supported/Plausible may ground a KEY REASON or DISSENT`);
  }

  // v2 REQ-01: a DISSENT section citing >=1 surviving point must exist — EXCEPT a WAIT verdict with
  // zero Supported/Plausible ratings (arc-council.md step-6 escape hatch: nothing survived to cite).
  // The header is matched ANCHORED to line-start so the word "dissent" in prose can't stand in for it.
  const dm = text.match(/(?:^|\n)[ \t]*DISSENT\b([\s\S]*?)(?=\n[ \t]*CHEAPEST TEST|\n##\s|$)/i);
  const dissentCited = dm ? [...new Set([...dm[1].matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase()))] : [];
  const surviving = ratedIds.filter((id) => /^(Supported|Plausible)$/.test(ratings[id]));
  const waitExempt = decision === "WAIT" && surviving.length === 0;
  if (!waitExempt && dissentCited.length === 0)
    fail(`${verdictFile}: no DISSENT section citing a [Pn] surviving point (decision-core check; only an all-Weak WAIT is exempt)`);

  // v2 REQ-03: a present ## UNRESOLVED must cite >=1 BRACKETED rebuttal-set POINT-ID (a rated id or a
  // ## DISPUTED-listed id) — a bare prose token like "Q4" or "CO2" is not a citation.
  const um = text.match(/##\s*UNRESOLVED([\s\S]*?)(?=\n##\s|$)/i);
  if (um) {
    const disputedText = (text.match(/##\s*DISPUTED([\s\S]*?)(?=\n##\s|$)/i) || [, ""])[1];
    const disputedIds = new Set([...disputedText.matchAll(/\b([A-Z]{1,2}\d+)\b/g)].map((m) => m[1].toUpperCase()));
    const unresolvedCited = [...um[1].matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase());
    if (!unresolvedCited.some((id) => ratings[id] || disputedIds.has(id)))
      fail(`${verdictFile}: ## UNRESOLVED present but cites no bracketed rebuttal-set POINT-ID (a rated or DISPUTED id) — list the unresolved IDs or drop the section`);
  }

  // fairness invariant (Phase 4): the Chair pre-registers a prediction before reading the verifier
  if (!/^\s*PREDICTION:/im.test(text))
    fail(`${verdictFile}: no PREDICTION: line — the Chair must pre-register a prediction before reading the verifier (fairness invariant)`);
  report();
}

// ------------------------------------------------------------------ brief mode
if (briefFile) {
  if (!existsSync(briefFile)) {
    fail(`brief file not found: ${briefFile}`);
    report();
  }
  const text = readFileSync(briefFile, "utf8");
  const modeMatch = text.match(/Research mode:\s*(live|model-knowledge)/i);
  const mode = modeMatch ? modeMatch[1].toLowerCase() : null;
  if (!mode) fail(`${briefFile}: no "Research mode: live|model-knowledge" line`);

  const factLines = text.split(/\r?\n/).filter((l) => /^\s*[-*]\s*F\d+\b/.test(l));
  if (factLines.length < 3)
    fail(`${briefFile}: ${factLines.length} fact(s) — a deep Evidence Brief needs >=3 (REQ-04)`);
  for (const line of factLines) {
    const id = (line.match(/\b(F\d+)\b/) || [])[1] || "F?";
    const conf = (line.match(/[\[(](High|Med|Medium|Low)[\])]/i) || [])[1];
    if (!conf) {
      fail(`${briefFile}: fact ${id} has no [High|Med|Low] confidence label`);
      continue;
    }
    const isLow = /^low$/i.test(conf) || /\b(unverified|model prior|model-knowledge|single source)\b/i.test(line);
    const urls = (line.match(/https?:\/\/\S+/g) || []).length;
    if (mode === "live" && !isLow && urls < 2)
      fail(`${briefFile}: fact ${id} is ${conf} in a live brief but has ${urls} source URL(s) — need >=2 independent sources or an explicit low-confidence mark (REQ-04)`);
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

const CORE_AGENTS = [
  "council-advocate",
  "council-skeptic",
  "council-neutral",
  "council-verifier",
  "council-researcher",
];
// Phase 3: the 7 domain experts (convened per-question by the Chair, but all must EXIST). REQ-07.
const DOMAIN_AGENTS = [
  "council-strategist",
  "council-risk-analyst",
  "council-marketer",
  "council-designer",
  "council-engineer",
  "council-policy-analyst",
  "council-life-counselor",
];
for (const name of [...CORE_AGENTS, ...DOMAIN_AGENTS]) {
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
