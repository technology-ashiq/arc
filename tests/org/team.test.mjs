// org Phase 02 -- a venture's team manifest: proposal, grammar, governance, install closure (REQ-06, REQ-07;
// ADR-1606 / ADR-1615 / ADR-1616 / ADR-1619). Migrated from tests/org-team.bats (ci Phase 02). A team manifest
// cannot change silently: org-team --check passes only when an org.team approval carries the manifest's exact
// digest and the owner approved it. `sync-to-project --team` must install exactly what `--products <closure>`
// installs -- one installer, never a second. Scratch trees only; the repo's own org/teams/ is never written.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ARC_ROOT, runNode, runBash, tmpDir, mutate, sed, treeManifest, suite } from "../_lib/arc.mjs";
import { orgScratch } from "./scratch.mjs";

const { test, registered, declared } = suite(import.meta.url);
const TEAM = join(ARC_ROOT, ".claude/scripts/org/org-team.mjs");
const CATALOG = join(ARC_ROOT, ".claude/scripts/org/org-catalog.mjs");
const COVERAGE = join(ARC_ROOT, ".claude/scripts/org/org-coverage.mjs");
const U = "01M0VEWDEC0000000000000001";

// A scratch arc tree with one venture (lexos, from ventures.yaml) and its team proposed.
function teamTree(t) {
  const d = orgScratch(t, { products: true, init: "lexos" });
  assert.ok(existsSync(join(d, "org/teams/lexos.team.yaml")), "fixture failed");
  return d;
}
const digestOf = (d) => (runNode(TEAM, ["--digest", "lexos", "--root", d]).stdout.match(/^digest: (.*)$/m) || [])[1];
const teamSpine = (d, sp, mode, dg) => assert.equal(runNode(join(ARC_ROOT, "tests/org/team-spine.mjs"), [sp, "lexos", dg, mode]).status, 0, `team-spine ${mode}`);
const interviewSpine = (sp, mode) => assert.equal(runNode(join(ARC_ROOT, "tests/org/interview-spine.mjs"), [sp, "qa-tester", mode]).status, 0, `interview-spine ${mode}`);
// portable on all three legs, as the bats file did it: drop the pending line, append the list
const giveFixtures = (c) => {
  const kept = readFileSync(c, "utf8").split("\n").filter((l) => l !== "fixtures: 'pending'");
  writeFileSync(c, kept.join("\n").replace(/\n?$/, "\n") + "fixtures:\n  - 'products/bench/fixtures/qa-01.json'\n");
  assert.ok(readFileSync(c, "utf8").includes("qa-01.json"), "fixture edit failed");
};

test("org-team: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-team: --init proposes a valid discover team with E2 seats held by the owner, and never overwrites", (t) => {
  const d = teamTree(t);
  let r = runNode(TEAM, ["--validate", "lexos", "--root", d]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.startsWith("org-team: lexos valid -- digest "), r.output);
  assert.match(readFileSync(join(d, "org/teams/lexos.team.yaml"), "utf8"), /^mission: 'private'$/m);
  r = runNode(TEAM, ["--init", "lexos", "--root", d]);
  assert.ok(r.status === 1 && r.output.includes("never overwritten"), r.output);
});

test("org-team: --init refuses a venture that is not registered", (t) => {
  const d = teamTree(t);
  const r = runNode(TEAM, ["--init", "zz-unregistered", "--root", d]);
  assert.ok(r.status === 1 && r.output.includes("not in ventures.yaml"), r.output);
  assert.ok(!existsSync(join(d, "org/teams/zz-unregistered.team.yaml")));
});

test("org-team: an unapproved team is an UNRECEIPTED TEAM CHANGE (REQ-06)", (t) => {
  const d = teamTree(t);
  const dg = digestOf(d);
  assert.match(String(dg), /^[0-9a-f]{64}$/, "no digest");
  for (const mode of ["none", "reject", "near-miss", "twice"]) {
    teamSpine(d, join(d, `sp-${mode}`), mode, dg);
    const r = runNode(TEAM, ["--check", "lexos", "--root", d, "--spine-dir", join(d, `sp-${mode}`)]);
    assert.equal(r.status, 1, `${mode} governed a team: ${r.output}`);
    assert.ok(r.output.startsWith("UNRECEIPTED TEAM CHANGE: "), `${mode}: ${r.output}`);
  }
  // logic attack L1: approve then a second decision is refused by name, not read as the later or the earlier verdict
  const r = runNode(TEAM, ["--check", "lexos", "--root", d, "--spine-dir", join(d, "sp-twice")]);
  assert.ok(r.output.includes("carries more than one decision"), `twice: ${r.output}`);
});

test("org-team: an approved digest governs, a comment keeps it, a value change breaks it", (t) => {
  const d = teamTree(t);
  const dg = digestOf(d);
  assert.match(String(dg), /^[0-9a-f]{64}$/, "no digest");
  const sp = join(d, "sp");
  teamSpine(d, sp, "approve", dg);
  const check = () => runNode(TEAM, ["--check", "lexos", "--root", d, "--spine-dir", sp]);
  let r = check();
  assert.ok(r.status === 0 && r.output.startsWith(`org-team: lexos governed -- digest ${dg} approved by `), r.output);
  appendFileSync(join(d, "org/teams/lexos.team.yaml"), "# a comment is bytes, not values\n");
  r = check();
  assert.equal(r.status, 0, `a comment broke governance: ${r.output}`);
  mutate(join(d, "org/teams/lexos.team.yaml"), sed(/^ {2}queue_cap: 7$/, "  queue_cap: 6"));
  r = check();
  assert.ok(r.status === 1 && r.output.startsWith("UNRECEIPTED TEAM CHANGE: "), `a silent edit passed: ${r.output}`);
});

test("org-team: the gate refuses an E2 role on shift that the owner does not hold", (t) => {
  const d = teamTree(t);
  writeFileSync(join(d, "org/teams/lexos.team.yaml"), "venture: 'lexos'\nstage: 'validate'\nmission: 'private'\non_shift:\n  validate:\n    - 'pricing-strategist'\nseats:\n  pricing-strategist:\n    holder: 'card'\ndispatch:\n  heartbeat: 'daily'\n  queue_cap: 7\n");
  const r = runNode(COVERAGE, ["--root", d]);
  assert.ok(r.output.includes("org-coverage: "), `did not run: ${r.output}`);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("pricing-strategist touches E2 (changing prices) -- its holder must be human:ashiq"), r.output);
});

test("org-team: a queue cap above 7 is refused (REQ-10)", (t) => {
  const d = teamTree(t);
  mutate(join(d, "org/teams/lexos.team.yaml"), sed(/^ {2}queue_cap: 7$/, "  queue_cap: 8"));
  const r = runNode(TEAM, ["--validate", "lexos", "--root", d]);
  assert.ok(r.status === 1 && r.output.includes("queue_cap must be 1..7"), r.output);
});

test("org-team: sync --team installs byte-for-byte what --products <the team closure> installs (REQ-07)", (t) => {
  const tmp = tmpDir(t, "team-sync-");
  const src = join(tmp, "src");
  mkdirSync(src, { recursive: true });
  // git archive HEAD | tar -x, as the bats file did: the committed tree, never the working copy
  // tar runs IN src, never `-C <path>`: GNU tar reads a `C:\...` argument as host:path on Windows.
  const a = spawnSync("bash", ["-c", 'git -C "$1" archive HEAD | tar -x', "sh", ARC_ROOT], { encoding: "utf8", cwd: src });
  assert.equal(a.status, 0, `archive failed: ${a.stderr}`);
  assert.ok(existsSync(join(src, "sync-to-project.sh")), "archive is empty");
  assert.equal(runNode(join(src, ".claude/scripts/org/org-team.mjs"), ["--init", "lexos", "--root", src]).status, 0, "init failed");
  let r = runNode(join(src, ".claude/scripts/org/org-team.mjs"), ["--products-for", "lexos", "--root", src]);
  assert.equal(r.status, 0, r.output);
  const closure = r.output;
  assert.ok(`,${closure},`.includes(",core,"), `core missing from ${closure}`);
  mkdirSync(join(tmp, "a")); mkdirSync(join(tmp, "b"));
  r = runBash(join(src, "sync-to-project.sh"), [join(tmp, "a"), "--team", "lexos"]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes(`sync: team lexos -> products ${closure}`), r.output);
  r = runBash(join(src, "sync-to-project.sh"), [join(tmp, "b"), "--products", closure]);
  assert.equal(r.status, 0, r.output);
  const ma = treeManifest(join(tmp, "a"));
  assert.ok(ma.trim().length > 0, "nothing installed");
  assert.equal(ma, treeManifest(join(tmp, "b")));
});

test("org-team: --team and --products are exclusive, and an unknown team fails the sync", (t) => {
  const d = join(tmpDir(t, "team-x-"), "t");
  mkdirSync(d);
  let r = runBash(join(ARC_ROOT, "sync-to-project.sh"), [d, "--team", "zz-none"]);
  assert.equal(r.status, 2, r.output);
  assert.ok(r.output.includes("--team zz-none did not resolve"), r.output);
  r = runBash(join(ARC_ROOT, "sync-to-project.sh"), [d, "--products", "core", "--team", "zz-none"]);
  assert.equal(r.status, 2, r.output);
});

test("org-hire: a seat is staffed only by an approved org.role interview naming it (REQ-11)", (t) => {
  const d = teamTree(t);
  const c = join(d, "org/roles/e-engineering/qa-tester.role.yaml");
  const hire = (sp) => runNode(CATALOG, ["--hire", "qa-tester", "--interview", U, "--spine-dir", sp, "--root", d]);
  let r = hire(join(d, "none"));
  assert.ok(r.status === 1 && r.output.includes("fixtures: pending -- an interview needs a fixture set"), r.output);
  giveFixtures(c);
  for (const mode of ["reject", "other-role", "wrong-subject", "twice"]) {
    interviewSpine(join(d, `sp-${mode}`), mode);
    r = hire(join(d, `sp-${mode}`));
    assert.ok(r.status === 1 && r.output.startsWith("FAIL qa-tester: "), `${mode} hired: ${r.output}`);
  }
  interviewSpine(join(d, "sp-ok"), "approve");
  r = hire(join(d, "sp-ok"));
  assert.ok(r.status === 0 && r.output === `org-catalog: qa-tester staffed by interview ${U}; review_by 2026-10-03`, r.output);
  assert.match(readFileSync(c, "utf8"), new RegExp(`^legitimacy: 'interview:${U}'$`, "m"));
  r = runNode(COVERAGE, ["--root", d, "--spine-dir", join(d, "sp-ok")]);
  assert.equal(r.status, 0, r.output);
  r = runNode(COVERAGE, ["--root", d, "--spine-dir", join(d, "sp-reject")]);
  assert.ok(r.status === 1 && r.output.includes(`qa-tester: interview ${U} was not approved (REQ-11)`), r.output);
  // logic attack L5: an approve followed by a second decision on the same request is an edited spine, never a hire
  r = runNode(COVERAGE, ["--root", d, "--spine-dir", join(d, "sp-twice")]);
  assert.ok(r.status === 1 && r.output.includes(`qa-tester: interview ${U} decides a request that carries more than one decision`), r.output);
});

test("org-hire: a request decided twice refuses the hire stamp by name (logic attack L5)", (t) => {
  const d = teamTree(t);
  const c = join(d, "org/roles/e-engineering/qa-tester.role.yaml");
  giveFixtures(c);
  const sp = join(d, "sp");
  interviewSpine(sp, "twice");
  assert.equal(readFileSync(join(sp, "events/2026-09-03.jsonl"), "utf8").split("\n").filter(Boolean).length, 3, "twice fixture is not three events");
  const r = runNode(CATALOG, ["--hire", "qa-tester", "--interview", U, "--spine-dir", sp, "--root", d]);
  assert.ok(r.status === 1 && r.output.includes("carries more than one decision"), r.output);
  assert.ok(!/^legitimacy: 'interview:/m.test(readFileSync(c, "utf8")), "the card was stamped");
});
