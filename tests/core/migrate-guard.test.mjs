// ci Phase 02 REQ-09 -- migrate-guard FAILs each of six planted mutants, one per guard, and PASSes the clean
// migration they are planted into. Each case is a throwaway git repo: a base commit holding a bats lane, a head
// commit migrating it. The clean case is the negative control for all six: same repo, one change each.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ARC_ROOT, runNode, tmpDir } from "../_lib/arc.mjs";

const GUARD = join(ARC_ROOT, ".claude/scripts/core/migrate-guard.mjs");
const OLD = '@test "zz: one" {\n  [ 1 -eq 1 ]\n  [ "a" = "a" ]\n}\n\n@test "zz: two" {\n  [ 2 -eq 2 ]\n}\n';
const NEW = 'import assert from "node:assert/strict";\nimport { test } from "node:test";\n\ntest("zz: one", () => {\n  assert.equal(1, 1);\n  assert.equal("a", "a");\n});\n\ntest("zz: two", () => {\n  assert.equal(2, 2);\n});\n';
const MAP = "| old @test | new test | file | note |\n|---|---|---|---|\n| zz: one | zz: one | a.test.mjs | |\n| zz: two | zz: two | a.test.mjs | |\n";

function repo(t, plant = {}) {
  const d = join(tmpDir(t, "mg-"), "repo");
  mkdirSync(join(d, "tests"), { recursive: true });
  // repo-local identity: a clean CI runner has none, and a subshell env would not reach every git call
  const git = (...a) => execFileSync("git", a, { cwd: d, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "mg"); git("config", "user.email", "mg@example.invalid"); git("config", "commit.gpgsign", "false");
  writeFileSync(join(d, "tests/zz-a.bats"), OLD);
  writeFileSync(join(d, "README.md"), "base\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  rmSync(join(d, "tests/zz-a.bats"));
  mkdirSync(join(d, "tests/zz"), { recursive: true });
  writeFileSync(join(d, "tests/zz/a.test.mjs"), plant.newSrc ?? NEW);
  writeFileSync(join(d, "tests/zz/MIGRATED.md"), plant.map ?? MAP);
  writeFileSync(join(d, "tests/zz/.count"), plant.count ?? "2\n");
  if (plant.outside) writeFileSync(join(d, "README.md"), "edited by the worker\n");
  git("add", "-A"); git("commit", "-q", "-m", "migrate zz");
  return { d, base };
}
function guard(t, plant) {
  const { d, base } = repo(t, plant);
  const r = runNode(GUARD, ["zz", "--base", base], { cwd: d });
  assert.match(r.output, /^migrate-guard: lane zz, base /m, `the guard did not run: ${r.output}`);
  const row = (g) => (r.output.match(new RegExp(`^ {2}(PASS|FAIL) {2}${g} `, "m")) || [])[1];
  return { r, row };
}

test("migrate-guard: the clean migration PASSes every guard (the control)", (t) => {
  const { r, row } = guard(t, {});
  for (const g of ["path", "count", "names", "density", "skips", "green"]) assert.equal(row(g), "PASS", `${g}: ${r.output}`);
  assert.equal(r.status, 0, r.output);
});

const MUTANTS = [
  ["path", "a file outside the lane", { outside: true }],
  ["count", "a .count that does not match what ran", { count: "3\n" }],
  ["names", "an old @test missing from MIGRATED.md", { map: MAP.split("\n").filter((l) => !l.startsWith("| zz: two")).join("\n") }],
  ["density", "assertions thinned below 90%", { newSrc: NEW.replace('  assert.equal("a", "a");\n', "").replace("  assert.equal(2, 2);\n", "") }],
  ["skips", "a skipped test", { newSrc: NEW.replace('test("zz: two", () => {', 'test("zz: two", { skip: true }, () => {') }],
  ["green", "a new test that fails", { newSrc: NEW.replace("assert.equal(2, 2)", "assert.equal(2, 3)") }],
];
for (const [g, what, plant] of MUTANTS) {
  test(`migrate-guard: ${what} FAILs the ${g} guard`, (t) => {
    const { r, row } = guard(t, plant);
    assert.equal(row(g), "FAIL", `${g} did not fail: ${r.output}`);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /^migrate-guard: FAIL/m);
  });
}
