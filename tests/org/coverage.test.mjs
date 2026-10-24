// org Phase 00 -- the role catalog and its gate (REQ-01, REQ-03, REQ-13; REQ-11's gate arms;
// ADR-1609 / ADR-1610 / ADR-1614 / ADR-1615 / ADR-1620). Migrated from tests/org-coverage.bats (ci Phase 02).
// org-coverage fails, naming it, on an agent with no role and on a role naming something not in the tree. Counts
// are DERIVED from the tree in the test, never pinned. Every test asserts the gate RAN before what it printed.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, mutate, sed, suite } from "../_lib/arc.mjs";
import { orgScratch } from "./scratch.mjs";

const { test, registered, declared } = suite(import.meta.url);
const GATE = join(ARC_ROOT, ".claude/scripts/org/org-coverage.mjs");
const ran = (r) => assert.ok(r.output.includes("org-coverage: "), `the gate did not run: ${r.output}`);

test("org-coverage: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-coverage: the real tree is covered, with counts derived from the tree", () => {
  const roles = readdirSync(join(ARC_ROOT, "org/roles"), { recursive: true }).filter((f) => String(f).endsWith(".role.yaml")).length;
  const agents = readdirSync(join(ARC_ROOT, ".claude/agents"), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  assert.ok(roles > 0 && agents > 0);
  const r = runNode(GATE);
  ran(r);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes(`org-coverage: ${roles} roles (`), `role count is not the tree's ${roles}: ${r.output}`);
  assert.ok(r.output.includes(`, ${agents} agents, `), `agent count is not the tree's ${agents}: ${r.output}`);
  assert.ok(r.output.includes("-- all covered"), r.output);
});

test("org-coverage: the mutant self-test runs every arm and each fails closed", () => {
  const r = runNode(GATE, ["--mutant-selftest"]);
  const m = r.output.match(/mutant-selftest: ran ([0-9]+) of ([0-9]+)/);
  assert.ok(m, `the self-test did not run: ${r.output}`);
  const [done, total] = [Number(m[1]), Number(m[2])];
  assert.equal(done, total, `ran ${done} of ${total}: ${r.output}`);
  assert.ok(total >= 13, `only ${total} arms -- an arm was dropped: ${r.output}`);
  assert.equal(r.status, 0, r.output);
  assert.ok(!r.output.includes("FAILED-ARM"), `an arm failed: ${r.output}`);
  const lines = r.output.split("\n");
  for (let i = 0; i < total; i++) assert.ok(lines.some((l) => new RegExp(`^M${i} .*: PASS \\(exit [01], (cli|in-process)\\)$`).test(l)), `arm M${i} is not PASS: ${r.output}`);
  // Every planted arm names what it caught; only M0, the clean control, exits 0.
  assert.equal(lines.filter((l) => l.includes("EXPECTED-FAIL")).length, total - 1, r.output);
  assert.ok(lines.some((l) => /^M0 .*: PASS \(exit 0, cli\)$/.test(l)));
  // Only a walker-stub arm may run in-process; every other arm must have gone through the real CLI.
  assert.ok(lines.filter((l) => l.endsWith(", in-process)")).length <= 1, `more than one in-process arm: ${r.output}`);
});

test("org-coverage: an orphan agent fails end to end, named", (t) => {
  const d = orgScratch(t);
  writeFileSync(join(d, ".claude/agents/zz-orphan-agent.md"), "---\nname: zz-orphan-agent\n---\n");
  const r = runNode(GATE, ["--root", d]);
  ran(r);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('FAIL agent "zz-orphan-agent" belongs to no role'), r.output);
});

test("org-coverage: an E2 role moved to an agent seat fails, naming role and action", (t) => {
  const d = orgScratch(t);
  const card = join(d, "org/roles/c-research/pricing-strategist.role.yaml");
  assert.match(readFileSync(card, "utf8"), /^seat: 'human'$/m, "fixture card missing or not human");
  mutate(card, sed(/^seat: 'human'$/, "seat: 'agent'"));
  const r = runNode(GATE, ["--root", d]);
  ran(r);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("pricing-strategist: touches E2 (changing prices)"), r.output);
});

test("org-coverage: a role binding a script that does not exist fails, named", (t) => {
  const d = orgScratch(t);
  rmSync(join(d, ".claude/scripts/leads/arc-leads.mjs"));
  const r = runNode(GATE, ["--root", d]);
  ran(r);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('lead-researcher: binds script ".claude/scripts/leads/arc-leads.mjs", which does not exist'), r.output);
});

test("org-coverage: an unknown flag is refused by name, exit 2", () => {
  const r = runNode(GATE, ["--roots", "/tmp"]);
  assert.equal(r.status, 2);
  assert.ok(r.output.includes('unknown flag "--roots"'), r.output);
});
