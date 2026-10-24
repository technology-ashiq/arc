// org Phase 01 -- attribution + scorecard (REQ-05; ADR-1603 / ADR-1604; A-01). Migrated from
// tests/org-review.bats (ci Phase 02). org-review scores a seat only from receipts the attribution map places on
// it, against two written spines: `full`, and `weak` (a scheduler heartbeat and a kind-only receipt) -- the day-3
// checkpoint's negative control. Every test asserts the tool RAN before asserting what it printed.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, tmpDir, suite } from "../_lib/arc.mjs";
import { orgScratch } from "./scratch.mjs";

const { test, registered, declared } = suite(import.meta.url);
const REVIEW = join(ARC_ROOT, ".claude/scripts/org/org-review.mjs");

function spine(t, kind) {
  const d = join(tmpDir(t, "spine-"), kind);
  const r = runNode(join(ARC_ROOT, "tests/org/spine-fixture.mjs"), [d, kind]);
  assert.equal(r.status, 0, `fixture failed: ${r.output}`);
  assert.match(r.output, /^spine-fixture: [1-9]/, `empty fixture: ${r.output}`);
  return d;
}
const review = (...args) => runNode(REVIEW, args);

test("org-review: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-review: a role's runs are derived from its placed receipts", (t) => {
  const r = review("--role", "devops-release", "--spine-dir", spine(t, "full"));
  assert.ok(r.output.includes("org-review: "), `did not run: ${r.output}`);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /devops-release [\s\S]*runs 2 \(1 ok, 1 fail\)/);
});

test("org-review: a role with no placed receipt prints no evidence, never a zero or a percent", (t) => {
  const r = review("--role", "ux-writer", "--spine-dir", spine(t, "full"));
  assert.ok(r.output.includes("org-review: 0 of 1 role(s) with evidence"), `did not run: ${r.output}`);
  const lines = r.output.split("\n");
  assert.ok(lines.some((l) => /^ux-writer +vacant +no evidence$/.test(l)), r.output);
  assert.ok(!lines.filter((l) => l.startsWith("ux-writer")).some((l) => /%|runs 0/.test(l)), `a zero or percent: ${r.output}`);
});

test("org-review: a decision is placed on the role that raised the approval it decides", (t) => {
  const s = spine(t, "full");
  let r = review("--role", "sdr-outbound", "--spine-dir", s);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /sdr-outbound [\s\S]*accepts 1 · rejects 0/);
  r = review("--role", "build-in-public-social", "--spine-dir", s);
  assert.ok(r.output.includes("accepts 0 · rejects 1"), r.output);
});

test("org-review: payload.role outranks the map, and the disagreement is printed", (t) => {
  const r = review("--role", "qa-tester", "--spine-dir", spine(t, "full"));
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /qa-tester [\s\S]*runs 1 \(1 ok, 0 fail\)/);
  assert.match(r.output, /CONFLICT [\s\S]*payload\.role "qa-tester" but map rule commit-msg-draft says "devops-release"/);
});

test("org-review: unattributed receipts are counted, not guessed", (t) => {
  const r = review("--all", "--spine-dir", spine(t, "full"));
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("unattributed 1 of 11 receipt(s)"), r.output);
});

test("org-review: --audit recomputes every number independently and finds no difference", (t) => {
  const r = review("--audit", "--spine-dir", spine(t, "full"));
  const m = r.output.match(/audit: ([0-9]+) roles recomputed from 11 receipts/);
  assert.ok(m, `did not run: ${r.output}`);
  assert.ok(Number(m[1]) > 0);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("-- 0 difference(s)"), r.output);
});

test("org-review: the checkpoint proceeds on receipts placed by source-naming rules", (t) => {
  const r = review("--checkpoint", "--spine-dir", spine(t, "full"));
  assert.ok(r.output.includes("checkpoint: map digest "), `did not run: ${r.output}`);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes("PROCEED (>= 3)"), r.output);
  assert.ok(r.output.includes("  devops-release: 2 receipt(s)"), r.output);
});

test("org-review: the checkpoint STOPS on heartbeats and kind-only receipts (negative control)", (t) => {
  const r = review("--checkpoint", "--spine-dir", spine(t, "weak"));
  assert.ok(r.output.includes("checkpoint: map digest "), `did not run: ${r.output}`);
  assert.equal(r.status, 1, `a spine of heartbeats passed the checkpoint: ${r.output}`);
  assert.ok(r.output.includes("checkpoint: 0 seated role(s) measured from 3 receipts -- STOP"), r.output);
});

test("org-review: a map rule naming a role that is not a card stops scoring", (t) => {
  const d = orgScratch(t);
  appendFileSync(join(d, "org/attribution.yaml"), "  - id: 'zz-ghost'\n    match:\n      process: 'zz'\n    role: 'ghost-role'\n");
  const r = review("--all", "--spine-dir", spine(t, "full"), "--root", d);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('role "ghost-role" is not a card id'), r.output);
  assert.ok(r.output.includes("nothing scored"), r.output);
});

test("org-review: a map saved with a BOM and CRLF scores exactly as the plain map (logic attack L4)", (t) => {
  const d = orgScratch(t);
  const p = join(d, "org/attribution.yaml");
  const plain = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  writeFileSync(p, "﻿" + plain.replace(/\n/g, "\r\n"));
  assert.equal(readFileSync(p).subarray(0, 3).toString("hex"), "efbbbf", "the BOM was not written");
  const r = review("--role", "devops-release", "--spine-dir", spine(t, "full"), "--root", d);
  assert.ok(r.output.includes("org-review: "), `did not run: ${r.output}`);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /devops-release [\s\S]*runs 2 \(1 ok, 1 fail\)/);
});

test("org-review: modes are exclusive, flags are never given twice, unknown flags refused", () => {
  let r = review("--all", "--audit");
  assert.ok(r.status === 2 && r.output.includes("exactly one of"), r.output);
  r = review("--all", "--since", "2026-01-01", "--since", "2026-02-01");
  assert.ok(r.status === 2 && r.output.includes("--since given twice"), r.output);
  r = review("--al");
  assert.ok(r.status === 2 && r.output.includes('unknown flag "--al"'), r.output);
});

test("org-review: verdicts are derived, and heartbeat evidence never promotes (ADR-1607)", () => {
  const P = join(ARC_ROOT, "tests/org/probe.mjs");
  const base = '"evidence":true,"incidents":0,"accepts":0,"rejects":0';
  const v = (json) => runNode(P, ["verdict", json]).output;
  assert.equal(v('{"evidence":false}'), "VERDICT keep -- no evidence yet -- nothing to judge");
  assert.equal(v(`{${base},"runs":8,"runs_ok":0,"sourced":8}`), "VERDICT retire -- 8 runs, none ok");
  assert.ok(v(`{${base},"runs":4,"runs_ok":1,"sourced":4}`).startsWith("VERDICT retrain -- "));
  assert.equal(v(`{${base},"runs":35,"runs_ok":35,"sourced":0}`), "VERDICT keep -- ok 35/35 but 0 sourced -- heartbeat evidence never promotes");
  assert.ok(v(`{${base},"runs":5,"runs_ok":5,"sourced":5}`).startsWith("VERDICT promote -- "));
  assert.equal(v('{"evidence":true,"incidents":1,"accepts":0,"rejects":0,"runs":5,"runs_ok":5,"sourced":5}'), "VERDICT retrain -- 1 incident(s)");
});
