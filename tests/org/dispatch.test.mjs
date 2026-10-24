// org Phase 03 -- the dispatcher proposes, it never does (REQ-08, REQ-10; ADR-1602 / ADR-1605 / ADR-1606 /
// ADR-1616 / ADR-1623). Migrated from tests/org-dispatch.bats (ci Phase 02). Each test drives org-dispatch against a
// scratch tree holding a proposed lexos team and a written spine in one state. Nothing here emits: --emit writes
// to a real spine and is exercised only from the main clone by the scheduler.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, suite } from "../_lib/arc.mjs";
import { orgScratch } from "./scratch.mjs";

const { test, registered, declared } = suite(import.meta.url);
const DISPATCH = join(ARC_ROOT, ".claude/scripts/org/org-dispatch.mjs");
const TEAM = join(ARC_ROOT, ".claude/scripts/org/org-team.mjs");

// scratch tree + proposed lexos team + a spine in SCENARIO; one tree per test, many spines
function scenario(t, name, tree) {
  const d = tree ?? orgScratch(t, { products: true, init: "lexos" });
  const dg = (runNode(TEAM, ["--digest", "lexos", "--root", d]).stdout.match(/^digest: (.*)$/m) || [])[1];
  assert.match(String(dg), /^[0-9a-f]{64}$/, "fixture failed: no team digest");
  const sp = join(d, `sp-${name}`);
  const w = runNode(join(ARC_ROOT, "tests/org/dispatch-spine.mjs"), [sp, "lexos", dg, name]);
  assert.equal(w.status, 0, `fixture failed: ${w.output}`);
  return { tree: d, spine: sp };
}
const dispatch = (tree, spine) => runNode(DISPATCH, ["--venture", "lexos", "--root", tree, "--spine-dir", spine, "--today", "2026-09-30"]);

test("org-dispatch: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-dispatch: an ungoverned team gets no proposals at all", (t) => {
  const { tree } = scenario(t, "governed");
  mkdirSync(join(tree, "empty/events"), { recursive: true });
  const r = dispatch(tree, join(tree, "empty"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.startsWith("UNRECEIPTED TEAM CHANGE: lexos digest "), r.output);
  assert.ok(!r.output.includes("PROPOSE"), `proposed for an ungoverned team: ${r.output}`);
});

test("org-dispatch: a governed team gets a proposal with full goal ancestry for each unmet criterion", (t) => {
  const { tree, spine } = scenario(t, "governed");
  const r = dispatch(tree, spine);
  assert.ok(r.output.startsWith("lexos @ discover: "), `did not run: ${r.output}`);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("PROPOSE board-advisors: Put the idea to the board and record its verdict.  [discover exit criterion board-verdict unmet (0 of 1 council.verdict)] ancestry: private > discover > board-verdict > "), r.output);
});

test("org-dispatch: a vacant owner is a counted demand, and the third demand proposes a hire", (t) => {
  let s = scenario(t, "governed");
  let r = dispatch(s.tree, s.spine);
  assert.ok(r.output.includes("DEMAND pain-point-miner (1 of 3)"), r.output);
  assert.ok(!r.output.includes("PROPOSE recruiter"), `hired at one demand: ${r.output}`);
  s = scenario(t, "demand2", s.tree);
  r = dispatch(s.tree, s.spine);
  assert.ok(r.output.includes("DEMAND pain-point-miner (3 of 3)"), r.output);
  assert.ok(r.output.includes("PROPOSE recruiter: Hire for pain-point-miner: real work has wanted it 3 times  [vacancy-demand]"), r.output);
});

test("org-dispatch: a full queue proposes nothing more that day (REQ-10)", (t) => {
  const { tree, spine } = scenario(t, "queuefull");
  const r = dispatch(tree, spine);
  assert.ok(r.output.startsWith("lexos @ discover: 0 proposal(s), 0 vacancy demand(s); 7 already today of cap 7"), r.output);
  assert.ok(r.output.includes("skip queue full: 7 proposal(s) today against a cap of 7 (REQ-10)"), r.output);
});

test("org-dispatch: a seat over its budget line gets one budget-cap request and no work (ADR-1616)", (t) => {
  const { tree, spine } = scenario(t, "budget");
  const r = dispatch(tree, spine);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /PROPOSE board-advisors: Budget line for board-advisors is spent \(500 minor INR, 0 tokens\)[\s\S]*\[budget-cap\]/);
  assert.ok(!r.output.includes("PROPOSE board-advisors: Put the idea"), `proposed work to a capped seat: ${r.output}`);
});

test("org-dispatch: every criterion met proposes the stage change, and only proposes it", (t) => {
  const { tree, spine } = scenario(t, "stage-exit");
  const r = dispatch(tree, spine);
  assert.ok(r.output.includes("PROPOSE coo-dispatcher: Move lexos from discover to validate: every discover exit criterion reads true  [stage-exit]"), r.output);
  assert.match(readFileSync(join(tree, "org/teams/lexos.team.yaml"), "utf8"), /^stage: 'discover'$/m, "the dispatcher moved the stage itself");
});

test("org-dispatch: an open proposal for the same role and criterion is never raised twice", (t) => {
  const { tree, spine } = scenario(t, "open");
  const r = dispatch(tree, spine);
  assert.ok(r.output.includes("skip discover.board-verdict: a proposal to board-advisors is already open"), r.output);
  assert.ok(!r.output.includes("PROPOSE board-advisors"), `raised twice: ${r.output}`);
});

test("org-dispatch: usage -- one of --venture or --all, flags never twice, unknown refused", () => {
  let r = runNode(DISPATCH, ["--venture", "lexos", "--all"]);
  assert.ok(r.status === 2 && r.output.includes("exactly one of --venture V or --all"), r.output);
  r = runNode(DISPATCH, ["--all", "--today", "2026-09-30", "--today", "2026-10-01"]);
  assert.ok(r.status === 2 && r.output.includes("--today given twice"), r.output);
  r = runNode(DISPATCH, ["--al"]);
  assert.ok(r.status === 2 && r.output.includes('unknown flag "--al"'), r.output);
});
