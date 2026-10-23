// ci Phase 01 (REQ-05, ADR-2203): which lanes a pre-push runs. --dry-run plans and runs nothing, so these
// assert the mapping without spawning a suite. Each case asserts the script RAN (a `lanes:` line) first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, ".claude", "scripts", "core", "test-changed.mjs");

function plan(paths, stdin) {
  const args = [SCRIPT, "--dry-run"];
  if (stdin !== undefined) args.push("--stdin");
  if (paths) {
    const f = join(mkdtempSync(join(tmpdir(), "tc-")), "files");
    writeFileSync(f, paths.join("\n") + "\n");
    args.push("--files", f);
  }
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", input: stdin ?? "" });
  const line = (r.stdout.match(/^lanes: (.*)$/m) || [])[1];
  assert.ok(line !== undefined, `no lanes line -- did it run?\n${r.stdout}${r.stderr}`);
  assert.equal(r.status, 0, r.stderr);
  return { lanes: line === "(none)" ? [] : line.split(" "), out: r.stdout };
}

test("a lane script maps to that lane only", () => {
  assert.deepEqual(plan([".claude/scripts/spine/x.mjs"]).lanes, ["spine"]);
});

test("a lane's own bats file maps to that lane", () => {
  assert.deepEqual(plan(["tests/spine-emit.bats"]).lanes, ["spine"]);
});

test("a core script runs core plus every migrated lane, and says why", () => {
  const p = plan([".claude/scripts/core/y.mjs"]);
  assert.ok(p.lanes.includes("core"), p.out);
  assert.match(p.out, /why: .*core/);
});

test("a path no lane matches runs core and says why", () => {
  const p = plan(["somewhere/odd.txt"]);
  assert.ok(p.lanes.includes("core"), p.out);
  assert.match(p.out, /no lane matches somewhere\/odd\.txt/);
});

test("a docs-only change runs no tests", () => {
  // built from parts: a path this file spelled out whole would be "named by a test", which is code.
  assert.deepEqual(plan([["initiatives", "ci", "PROGRESS.md"].join("/"), ["docs", "adr", "2200-zz.md"].join("/")]).lanes, []);
});

test("a doc a test names by its path is code, not paperwork (attack p01 L3)", () => {
  const p = plan(["docs/memory/aliases.md", ["initiatives", "engine", "evidence", "phase-04", "zz.md"].join("/")]);
  assert.ok(p.lanes.length > 0, p.out);
});

test("a delete push (all-zero local sha) maps to nothing", () => {
  const z = "0".repeat(40);
  assert.deepEqual(plan(null, `(delete) ${z} refs/heads/gone ${"a".repeat(40)}\n`).lanes, []);
});

test("a lane with no test file of its own runs the core set, never nothing (attack p01 B2)", () => {
  const p = plan([".claude/scripts/zzlane/x.mjs"]);
  assert.ok(p.lanes.includes("core"), p.out);
  assert.match(p.out, /lane zzlane maps to no test file -> core/);
});

test("fixtures and _lib are never a lane of tests (attack p01 B9)", () => {
  const p = plan([".claude/scripts/core/y.mjs"]);
  assert.ok(!p.lanes.includes("fixtures") && !p.lanes.includes("_lib"), p.out);
  assert.ok(!/^ {2}tests\/(fixtures|_lib)\//m.test(p.out), p.out);
});

test("a hyphenated lane keeps its whole name, never its first word (attack p01 L4)", () => {
  assert.deepEqual(plan(["tests/model-policy-zz.bats"]).lanes.filter((l) => l !== "core"), ["model-policy"]);
});
