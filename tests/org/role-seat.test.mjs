// org Cycle 20 Phase 00 -- a process names a role; arc-run seats an agent (REQ-01, REQ-02, ADR-1626).
// Migrated from tests/org-role-seat.bats (ci Phase 02). Every arc-run assertion observes the CHILD (the prompt the
// fake CLI received) as well as the receipt: receipts are written by the code under test, so a suite reading only
// receipts asks the accused to testify.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ARC_ROOT, runNode, tmpDir, mutant, sed, suite } from "../_lib/arc.mjs";

const { test } = suite(import.meta.url);
const RUN = join(ARC_ROOT, ".claude/scripts/engine/arc-run.mjs");
const LINT = join(ARC_ROOT, ".claude/scripts/engine/process-lint.mjs");
const CLI = join(ARC_ROOT, "tests/fixtures/org/fake-claude-seat.mjs");
const CARD = join(ARC_ROOT, "org/roles/e-engineering/devops-release.role.yaml");
const PROCESS = join(ARC_ROOT, "processes/commit-msg-draft.process.yaml");

// bats setup(): a fresh spine and prompt file per test, exported to every child
function ctx(t) {
  const d = tmpDir(t, "role-seat-");
  const spine = join(d, "spine");
  mkdirSync(spine, { recursive: true });
  const prompt = join(d, "prompt.txt");
  const env = { ARC_SPINE_ROOT: spine, FAKE_CLAUDE_PROMPT_FILE: prompt };
  return {
    prompt,
    run: (args, extra = {}) => runNode(RUN, args, { env: { ...env, ...extra } }),
    READ: (...a) => runNode(join(ARC_ROOT, "tests/fixtures/engine/read-receipt.mjs"), [spine, ...a]).stdout.trim(),
  };
}
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const nonEmpty = (f) => existsSync(f) && statSync(f).size > 0;

test("role-seat: the resolver fixture runs every check clean", () => {
  const r = runNode(join(ARC_ROOT, "tests/org/role-seat.mjs"));
  assert.ok(r.output.includes("RAN role-seat "), `the fixture never ran: ${r.output}`);
  assert.ok(r.output.includes(", 0 failed"), r.output);
  assert.equal(r.status, 0);
});

test("role-seat: lint passes the real processes, which now name their roles", () => {
  assert.equal(readFileSync(PROCESS, "utf8").split("\n").filter((l) => l.startsWith("role: ")).length, 1, "commit-msg-draft names no role");
  const r = runNode(LINT, ["--all", "--root", ARC_ROOT]);
  assert.equal(r.status, 0, r.output);
});

test("role-seat: lint FAILs a role with no card, and a card that binds another process", (t) => {
  let f = mutant(t, PROCESS, sed(/^role: .*/, "role: no-such-role"));
  assert.match(readFileSync(f, "utf8"), /^role: no-such-role$/m, "the mutant was not written");
  let r = runNode(LINT, ["--root", ARC_ROOT, f]);
  assert.notEqual(r.status, 0);
  assert.match(r.output, /\[role-card\][\s\S]*no role card has id/);
  f = mutant(t, PROCESS, sed(/^role: .*/, "role: code-reviewer"));
  r = runNode(LINT, ["--root", ARC_ROOT, f]);
  assert.notEqual(r.status, 0);
  assert.match(r.output, /\[role-card\][\s\S]*binds process/);
});

test("role-seat: a default run receipts the role and keeps the prompt unseated", (t) => {
  const c = ctx(t);
  const r = c.run(["--process", "commit-msg-draft", "--driver", "claude-code", "--root", ARC_ROOT], { ARC_CLAUDE_CLI: CLI });
  assert.equal(r.status, 0, r.output);
  assert.ok(nonEmpty(c.prompt), "the fake CLI never ran");
  assert.equal(c.READ("payload", "role"), "devops-release");
  // devops-release binds no agent: nobody sits it, and the receipt says so rather than inventing one.
  assert.equal(c.READ("payload", "role_agent_source"), "none");
  assert.ok(!/^SEAT: /m.test(readFileSync(c.prompt, "utf8")), "a default run carried a persona");
});

test("role-seat: --trial-seat puts the agent in front of the process, receipts trial, and leaves the card alone", (t) => {
  const c = ctx(t);
  const before = sha(CARD);
  const r = c.run(["--process", "commit-msg-draft", "--driver", "claude-code", "--trial-seat", "code-reviewer", "--root", ARC_ROOT], { ARC_CLAUDE_CLI: CLI });
  assert.equal(r.status, 0, r.output);
  assert.ok(nonEmpty(c.prompt), "the fake CLI never ran");
  assert.match(readFileSync(c.prompt, "utf8"), /^SEAT: code-reviewer \(trial for role devops-release\)$/m, "the persona never reached the CLI");
  assert.equal(c.READ("payload", "role_agent"), "code-reviewer");
  assert.equal(c.READ("payload", "role_agent_source"), "trial");
  assert.equal(c.READ("payload", "trial_role"), "devops-release");
  // A trial earns the seat no scorecard credit: no payload.role at all.
  assert.equal(c.READ("payload", "role"), "ABSENT");
  assert.equal(sha(CARD), before, "the run changed the card");
});

test("role-seat: --trial-seat refuses twice, empty, unknown, and on a process with no role -- exit 2, no receipt", (t) => {
  const c = ctx(t);
  let r = c.run(["--process", "commit-msg-draft", "--driver", "claude-code", "--trial-seat", "code-reviewer", "--trial-seat", "developer", "--root", ARC_ROOT]);
  assert.ok(r.status === 2 && r.output.includes("given twice"), `twice: ${r.status} ${r.output}`);
  r = c.run(["--process", "commit-msg-draft", "--driver", "claude-code", "--trial-seat", "", "--root", ARC_ROOT]);
  assert.equal(r.status, 2, `empty: ${r.status} ${r.output}`);
  r = c.run(["--process", "commit-msg-draft", "--driver", "claude-code", "--trial-seat", "no-such-agent", "--root", ARC_ROOT]);
  assert.ok(r.status === 2 && r.output.includes("not an agent in .claude/agents/"), `unknown: ${r.status} ${r.output}`);
  r = c.run(["--process", "develop-proof", "--driver", "claude-code", "--trial-seat", "code-reviewer", "--root", ARC_ROOT]);
  assert.ok(r.status === 2 && r.output.includes("names none"), `no role: ${r.status} ${r.output}`);
  assert.equal(c.READ("kindcount", "run.completed"), "0", "a refusal left a receipt");
});

test("role-seat: --dry-run names the seat and why", (t) => {
  const c = ctx(t);
  const r = c.run(["--process", "review-diff", "--driver", "claude-code", "--dry-run", "--root", ARC_ROOT]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("role code-reviewer -> code-reviewer (card: "), r.output);
});

test("role-seat: a role process that emits a closed-payload kind still completes, role fields on run.completed only", (t) => {
  const c = ctx(t);
  const r = c.run(["--process", "council-convene", "--driver", "claude-code", "--input", '{"question":"a probe"}', "--root", ARC_ROOT],
    { ARC_CLAUDE_CLI: join(ARC_ROOT, "tests/fixtures/engine/fake-claude-stream.mjs"), FAKE_CLAUDE_RECEIPT: "fresh:council.verdict", FAKE_CLAUDE_PAUSE_MS: "0" });
  assert.equal(r.status, 0, r.output);
  assert.equal(c.READ("payload", "role"), "board-advisors");
  assert.equal(c.READ("payload", "role_agent"), "council-advocate");
  assert.equal(c.READ("payload", "role_agent_source"), "card");
});
