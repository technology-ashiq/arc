// ci Phase 02 -- gate-parity accepts a migrated lane's merge-time truth as `tests/<lane>/<file>.test.mjs::<name>`,
// with the bats arm's checks: the file exists, the test exists, and it cannot skip. Each case repoints the first
// bats merge_time row of a scratch enforcement.yaml, so the same row is the negative control for the others.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, tmpDir, copyTree, mutate } from "../_lib/arc.mjs";

const GP = join(ARC_ROOT, ".claude/scripts/core/gate-parity.mjs");

function tree(t, body) {
  const d = join(tmpDir(t, "gp-"), "tree");
  copyTree(d, [".claude/hooks", ".githooks", "arc.gates.yaml", "engine/enforcement.yaml",
    ...readdirSync(join(ARC_ROOT, "tests")).filter((f) => f.endsWith(".bats")).map((f) => `tests/${f}`)]);
  mkdirSync(join(d, "tests/zz"), { recursive: true });
  writeFileSync(join(d, "tests/zz/merge.test.mjs"), body);
  // the first bats-backed merge_time row now names the node test
  mutate(join(d, "engine/enforcement.yaml"), (s) => s.replace(/merge_time: "tests\/[A-Za-z0-9._-]+\.bats::[^"]+"/, 'merge_time: "tests/zz/merge.test.mjs::zz: the truth"'));
  return d;
}
const gaps = (d) => {
  const r = runNode(GP, ["--root", d]);
  assert.match(r.output, /^RAN gate-parity$/m, `gate-parity never reached its end: ${r.output}`);
  return r.output.split("\n").filter((l) => l.startsWith("GAP "));
};

test("gate-parity: a node merge-time test that exists and cannot skip is no gap", (t) => {
  const d = tree(t, 'test("zz: the truth", () => {\n  assert.ok(true);\n});\n');
  assert.deepEqual(gaps(d), []);
});

test("gate-parity: a node merge-time row naming a missing test is a gap", (t) => {
  const d = tree(t, 'test("zz: something else", () => {});\n');
  assert.ok(gaps(d).some((g) => g.includes('has no test("zz: the truth"')), gaps(d).join("\n"));
});

test("gate-parity: a node merge-time test that can skip, todo or only is a gap", (t) => {
  for (const body of ['test("zz: the truth", { skip: true }, () => {});\n', 'test("zz: the truth", (t) => {\n  t.skip();\n});\n', 'test("zz: the truth", { only: true }, () => {});\n']) {
    const d = tree(t, body);
    assert.ok(gaps(d).some((g) => g.includes("merge_time test can skip: tests/zz/merge.test.mjs::zz: the truth")), `${body}\n${gaps(d).join("\n")}`);
  }
});

test("gate-parity: a node file outside a lane dir is not a merge-time truth", (t) => {
  const d = tree(t, 'test("zz: the truth", () => {});\n');
  mutate(join(d, "engine/enforcement.yaml"), (s) => s.replace("tests/zz/merge.test.mjs::", "tests/merge.test.mjs::"));
  writeFileSync(join(d, "tests/merge.test.mjs"), readFileSync(join(d, "tests/zz/merge.test.mjs")));
  assert.ok(gaps(d).some((g) => g.includes("merge_time must be")), gaps(d).join("\n"));
});
