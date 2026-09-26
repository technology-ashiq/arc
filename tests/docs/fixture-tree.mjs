// A minimal arc tree for the docs suites: one of every entity the wiki renders, plus the real
// scripts it runs on (face-coverage and what it imports, the canonical YAML parser, wiki-build).
//
//   node tests/docs/fixture-tree.mjs <repo-root> <dest-dir>
//
// dest-dir must not exist yet. Prints the dest path on success. Test code: it may walk
// directories freely -- DOC-A binds .claude/scripts/docs/, not tests/.

import { mkdirSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const [repo, dest] = process.argv.slice(2);
if (!repo || !dest) { process.stderr.write("fixture-tree: usage: fixture-tree.mjs <repo-root> <dest-dir>\n"); process.exitCode = 2; }
else if (existsSync(dest)) { process.stderr.write(`fixture-tree: ${dest} already exists\n`); process.exitCode = 2; }
else build(repo, dest);

function put(rel, text) {
  const p = join(dest, ...rel.split("/"));
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, text);
}

function build(repo, dest) {
  for (const d of [".claude/scripts/core", ".claude/scripts/hq/lib", ".claude/scripts/docs"]) {
    cpSync(join(repo, ...d.split("/")), join(dest, ...d.split("/")), { recursive: true });
  }
  put(".claude/scripts/engine/yaml-subset.mjs", "");
  cpSync(join(repo, ".claude", "scripts", "engine", "yaml-subset.mjs"), join(dest, ".claude", "scripts", "engine", "yaml-subset.mjs"));

  put("products/alpha/manifest.json", JSON.stringify({
    name: "alpha", version: "1.2.3", requires: ["core"], commands: [".claude/commands/alpha-go.md"],
    agents: [".claude/agents/alpha-helper.md"], scripts: [".claude/scripts/alpha/run.mjs"], files: [], docs: [],
  }, null, 2) + "\n");
  put("initiatives/alpha/PROGRESS.md", "# PROGRESS.md — alpha\n\nstatus: LIVE\ncycle: alpha (Cycle 1, opened 2026-09-25)\nphase: 00\nappetite: 2d\nburn: 0d\nblocked-on: —\ndepends-on: —\n\n> prose\n");
  put("initiatives/alpha/PLAN.md", "# PLAN.md — alpha\n");
  put("processes/alpha.process.yaml", "name: alpha\nversion: 1.0.0\nintent: \"do the alpha thing\"\npermissions: read-only\ninputs:\n  - name: goal\n    type: string\ntools:\n  - fs.read\n");
  put("docs/adr/0001-first-decision.md", "# ADR 0001 — The first decision\n\n**Status:** accepted\n**Date:** 2026-09-25\n**Product:** alpha\n**Reversibility:** two-way\n\n## Context\n");
  put(".claude/commands/alpha-go.md", "---\ndescription: Run alpha.\nargument-hint: <target>\n---\n\nbody\n");
  put(".claude/agents/alpha-helper.md", "---\nname: alpha-helper\ndescription: Helps alpha.\ntools: Read, Grep\nmodel: sonnet\n---\n\nbody\n");
  put(".claude/rules/alpha.md", "---\ndescription: Alpha rules.\n---\n\n# Alpha rules\n");
  put("arc.gates.yaml", "gates:\n  - name: alpha-gate\n    check: true\n    mode: warn\n    tier: ci\n    runtime: native\n    evidence: none\n");
  process.stdout.write(dest + "\n");
}
