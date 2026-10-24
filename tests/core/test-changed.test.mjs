// ci Phase 01 (REQ-05, ADR-2203): which lanes a pre-push runs. --dry-run plans and runs nothing, so these
// assert the mapping without spawning a suite. Each case asserts the script RAN (a `lanes:` line) first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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

// A-04 FIRED 2026-10-24: whole bats lanes blew the 5-minute cap, so a bats lane runs only what a change names.
const batsOf = (out) => out.split("\n").filter((l) => /^ {2}tests\/.*\.bats$/.test(l)).map((l) => l.trim());

test("a changed bats file runs itself, not the rest of its lane (A-04)", () => {
  assert.deepEqual(batsOf(plan(["tests/legal-publish-gate.bats"]).out), ["tests/legal-publish-gate.bats"]);
});

test("a changed script runs the bats files that name it, not its whole lane (A-04)", () => {
  const b = batsOf(plan([".claude/scripts/legal/publish-gate.mjs"]).out);
  assert.ok(b.includes("tests/legal-publish-gate.bats"), b.join(" "));
  assert.ok(!b.some((f) => f.startsWith("tests/legal-") && f !== "tests/legal-publish-gate.bats"), b.join(" "));
});

test("a changed script no bats file names runs its lane's bats whole, and says why (A-04)", () => {
  const p = plan([".claude/scripts/legal/zz-unnamed.mjs"]);
  assert.ok(batsOf(p.out).filter((f) => f.startsWith("tests/legal-")).length > 1, p.out);
  assert.match(p.out, /why: no test names \.claude\/scripts\/legal\/zz-unnamed\.mjs -> lane legal bats whole/);
});

test("a basename matches as a whole word: gate.mjs is not publish-gate.mjs (A-04 attack B2)", () => {
  const p = plan([".claude/scripts/legal/gate.mjs"]);
  assert.ok(!batsOf(p.out).includes("tests/legal-publish-gate.bats") || /lane legal bats whole/.test(p.out), p.out);
  assert.match(p.out, /why: no test names \.claude\/scripts\/legal\/gate\.mjs -> lane legal bats whole/);
});

test("a file not on the data list is code: a .cjs no test names runs its lane (A-04 attack B3)", () => {
  assert.match(plan([".claude/scripts/legal/zz.cjs"]).out, /why: no test names \.claude\/scripts\/legal\/zz\.cjs -> lane legal bats whole/);
});

test("an unnamed core script runs no bats lane, and says CI runs it (A-04 attack B4)", () => {
  const p = plan([".claude/scripts/core/zz-unnamed.mjs"]);
  assert.deepEqual(batsOf(p.out), []);
  assert.match(p.out, /why: no bats file names \.claude\/scripts\/core\/zz-unnamed\.mjs -> bats run on CI/);
});

test("a changed fixture runs the bats files naming its directory (A-04 attack L6)", () => {
  assert.deepEqual(batsOf(plan(["tests/fixtures/absorb/hostile/01-readme-injection.md"]).out), ["tests/absorb-hostile.bats"]);
});

test("a data file pulls no bats file, however many name it (A-04)", () => {
  const p = plan(["package.json"]);
  assert.ok(p.lanes.includes("core"), p.out);
  assert.deepEqual(batsOf(p.out), []);
});

test("a hyphenated lane keeps its whole name, never its first word (attack p01 L4)", () => {
  const p = plan(["tests/model-policy-zz.bats"]);
  assert.ok(p.lanes.includes("model-policy") && !p.lanes.includes("model"), p.out);
});

test("a data file runs the bats files naming its full path, not its bare name (A-04 attack r2 B3)", () => {
  const b = batsOf(plan(["engine/router.yaml"]).out);
  assert.ok(b.includes("tests/engine-attack-diff.bats"), b.join(" "));
  assert.ok(b.every((f) => readFileSync(join(ROOT, f), "utf8").includes("engine/router.yaml")), b.join(" "));
});
