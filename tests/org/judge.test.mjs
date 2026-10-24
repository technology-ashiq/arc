// org Cycle 20 Phase 01 -- a head's verdict on a worker's handoff lands on the spine (REQ-03, ADR-1627).
// Migrated from tests/org-judge.bats (ci Phase 02). The tree is a scratch copy of arc with one real team:
// solution-architect heads e-engineering, and code-reviewer and devops-release (both staffed, both reporting to
// it) are on shift. The spine holds one review-diff handoff.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, symlinkSync, cpSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, tmpDir, copyTree, suite } from "../_lib/arc.mjs";

const { test, registered, declared } = suite(import.meta.url);
const HANDOFF = "01M0JDGESPNEX0000000000001";
const RUN = "01M0JDGESPNEX0000000000002";

// bats setup(): a fresh spine per test, holding the handoff and a run receipt
function spine(t) {
  const sp = join(tmpDir(t, "judge-"), "spine");
  mkdirSync(sp, { recursive: true });
  const r = runNode(join(ARC_ROOT, "tests/org/judge-spine.mjs"), [sp]);
  assert.equal(r.output, `judge-spine: HANDOFF=${HANDOFF} RUN=${RUN}`, `the spine fixture was not written: ${r.output}`);
  return sp;
}
const READ = (sp, ...a) => runNode(join(ARC_ROOT, "tests/fixtures/engine/read-receipt.mjs"), [sp, ...a]).stdout.trim();

function judgeTree(t) {
  const d = join(tmpDir(t, "judge-tree-"), "tree");
  mkdirSync(join(d, "org/teams"), { recursive: true });
  copyTree(d, [".claude/agents", ".claude/skills", ".claude/scripts", "processes", "products", "engine/router.yaml", "hq.policy.yaml", "ventures.yaml"]);
  cpSync(join(ARC_ROOT, "org"), join(d, "org"), { recursive: true });
  writeFileSync(join(d, "org/teams/lexos.team.yaml"), [
    "venture: lexos", "stage: build", "mission: private", "on_shift:", "  build:", "    - solution-architect", "    - code-reviewer",
    "    - devops-release", "heads:", "  e-engineering: solution-architect", "seats: {}", "dispatch:", "  heartbeat: daily", "  queue_cap: 7", "",
  ].join("\n"));
  return d;
}
// ARC_SPINE_ROOT reaches the child explicitly, as bats exported it from setup()
const judge = (d, sp, args) => runNode(join(d, ".claude/scripts/org/org-judge.mjs"), [...args, "--root", d], { env: { ARC_SPINE_ROOT: sp } });

test("org-judge: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-judge: the decision fixture runs every check clean", () => {
  const r = runNode(join(ARC_ROOT, "tests/org/judge.mjs"));
  assert.ok(r.output.includes("RAN judge "), `the fixture never ran: ${r.output}`);
  assert.ok(r.output.includes(", 0 failed"), r.output);
  assert.equal(r.status, 0);
});

test("org-judge: a head's verdict lands once, judges the worker, and the audit still agrees", (t) => {
  const sp = spine(t);
  const d = judgeTree(t);
  let r = judge(d, sp, ["--head", "solution-architect", "--receipt", HANDOFF, "--verdict", "rework", "--reason", "tests missing for the parser"]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.startsWith("org-judge: review.completed "), r.output);
  assert.equal(READ(sp, "kindcount", "review.completed"), "1");
  r = runNode(join(d, ".claude/scripts/org/org-review.mjs"), ["--role", "code-reviewer", "--json", "--root", d, "--spine-dir", sp], { env: { ARC_SPINE_ROOT: sp } });
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes('"rejects": 1'), `the verdict was recorded and never judged: ${r.output}`);
  r = runNode(join(d, ".claude/scripts/org/org-review.mjs"), ["--audit", "--root", d, "--spine-dir", sp], { env: { ARC_SPINE_ROOT: sp } });
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("0 difference(s)"), r.output);
  // a second verdict on the same receipt is refused, and nothing more is written
  r = judge(d, sp, ["--head", "solution-architect", "--receipt", HANDOFF, "--verdict", "accept", "--reason", "fixed"]);
  assert.ok(r.status === 1 && r.output.includes("ALREADY_JUDGED:"), r.output);
  assert.equal(READ(sp, "kindcount", "review.completed"), "1");
});

test("org-judge: refusals name every failed condition and write nothing", (t) => {
  const sp = spine(t);
  const d = judgeTree(t);
  let r = judge(d, sp, ["--head", "solution-architect", "--receipt", RUN, "--verdict", "Accept", "--reason", "two"]);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("NOT_HANDOFF:") && r.output.includes("BAD_VERDICT:"), r.output);
  rmSync(join(d, "org/teams/lexos.team.yaml"));
  r = judge(d, sp, ["--head", "solution-architect", "--receipt", HANDOFF, "--verdict", "accept", "--reason", "fine", "--dry-run"]);
  assert.ok(r.status === 1 && r.output.includes("NO_TEAM:"), r.output);
  assert.equal(READ(sp, "kindcount", "review.completed"), "0");
});

test("org-judge: a dry run prints the payload and emits nothing", (t) => {
  const sp = spine(t);
  const d = judgeTree(t);
  const r = judge(d, sp, ["--head", "solution-architect", "--receipt", HANDOFF, "--verdict", "accept", "--reason", "clean", "--dry-run"]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes('"subject_role":"code-reviewer"'), r.output);
  assert.equal(READ(sp, "kindcount", "review.completed"), "0");
});

test("org-judge: run through a symlinked path, the CLI still runs (main guard realpaths both sides)", (t) => {
  // bats skipped this on Git Bash (its ln -s copies); node makes a real link on every OS -- a junction on
  // Windows, which needs no privilege -- so the case now runs on all three, never skipped.
  const sp = spine(t);
  const d = judgeTree(t);
  const link = join(tmpDir(t, "judge-link-"), "link");
  symlinkSync(d, link, process.platform === "win32" ? "junction" : "dir");
  const r = runNode(join(link, ".claude/scripts/org/org-judge.mjs"), ["--head", "solution-architect", "--receipt", HANDOFF, "--verdict", "accept", "--reason", "clean", "--root", d, "--dry-run"], { env: { ARC_SPINE_ROOT: sp } });
  assert.ok(r.status === 0 && r.output.includes("org-judge: would emit review.completed"), `the guard no-oped: status ${r.status} output [${r.output}]`);
});
