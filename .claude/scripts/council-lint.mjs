#!/usr/bin/env node
/**
 * council-lint — structural gate for the arc-council deliverable artifacts.
 * Zero deps. Exit 0 = artifacts structurally present & well-formed; exit 1 = named failures.
 *
 * Phase 0 scope (steel thread): the `/arc-council` command + the 3 core stance agents
 * (advocate/skeptic/neutral) exist with valid frontmatter.
 * Phase 1 extends this with the POINT-ID cross-reference + "verifier contested nothing" checks;
 * Phase 3 adds the researcher/verifier/7 domain agents to the roster below.
 *
 * Usage: node .claude/scripts/council-lint.mjs [repo-root]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || ".";
const failures = [];
const fail = (msg) => failures.push(msg);
const read = (p) => readFileSync(join(root, p), "utf8");
const exists = (p) => existsSync(join(root, p));

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

// ---- the command ----
const CMD = ".claude/commands/arc-council.md";
if (!exists(CMD)) fail(`${CMD} missing — build the arc-council command`);
else {
  const fm = frontmatter(read(CMD));
  if (!fm) fail(`${CMD}: no YAML frontmatter`);
  else
    for (const k of ["description", "argument-hint", "allowed-tools"])
      if (!fm[k]) fail(`${CMD}: frontmatter missing "${k}"`);
}

// ---- the core stance agents (Phase 0) ----
const CORE_AGENTS = ["council-advocate", "council-skeptic", "council-neutral"];
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

// ---- report ----
if (failures.length) {
  console.error(`council-lint: ${failures.length} check(s) FAILED\n`);
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error("\nFix and rerun.");
  process.exit(1);
}
console.log("council-lint: all checks passed ✔");
process.exit(0);
