// org Phase 00 -- the generated org chart and the catalog digest (REQ-04; ADR-1602 genesis).
// Migrated from tests/org-chart.bats (ci Phase 02). The chart is rendered from the cards, never typed: --check
// fails on a hand edit, every vacant role carries a VACANT banner, and every count equals a count taken from the
// cards in the test. The digest is over PARSED values, so reformatting a card leaves it alone and a value moves it.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, runNode, mutate, sed, suite } from "../_lib/arc.mjs";
import { orgScratch } from "./scratch.mjs";

const { test, registered, declared } = suite(import.meta.url);
const CAT = join(ARC_ROOT, ".claude/scripts/org/org-catalog.mjs");
const cards = (dir) => readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".role.yaml")).map((f) => join(dir, String(f)));
const digestOf = (out) => (out.match(/digest: ([0-9a-f]{64})/) || [])[1];

test("org-chart: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-chart: the committed chart is exactly what the cards render", () => {
  const r = runNode(CAT, ["--chart", "--check"]);
  assert.ok(r.output.includes("org-catalog: "), `the renderer did not run: ${r.output}`);
  assert.equal(r.status, 0, r.output);
});

test("org-chart: every vacant card has a VACANT banner and the counts are the cards' own", () => {
  const all = cards(join(ARC_ROOT, "org/roles"));
  const vacant = all.filter((f) => /^seat: 'vacant'$/m.test(readFileSync(f, "utf8"))).length;
  const roles = all.length;
  assert.ok(vacant > 0 && roles > 0);
  const chart = readFileSync(join(ARC_ROOT, "org/CHART.md"), "utf8");
  assert.equal(chart.split("\n").filter((l) => l.includes("**VACANT**")).length, vacant, `banners != ${vacant} vacant cards`);
  assert.ok(new RegExp(`^\\*\\*${roles} roles\\*\\* `, "m").test(chart), `chart does not report ${roles} roles`);
  assert.ok(chart.includes(` ${vacant} vacant `), `chart does not report ${vacant} vacant`);
});

test("org-chart: a hand edit to the chart is caught by --check", (t) => {
  const d = orgScratch(t);
  appendFileSync(join(d, "org/CHART.md"), "hand edit\n");
  const r = runNode(CAT, ["--chart", "--check", "--root", d]);
  assert.ok(r.output.includes("org-catalog: "), `the renderer did not run: ${r.output}`);
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("STALE org/CHART.md"), r.output);
});

test("org-chart: the digest ignores formatting and moves on any value change", (t) => {
  const d = orgScratch(t);
  let r = runNode(CAT, ["--digest", "--root", d]);
  assert.equal(r.status, 0, r.output);
  const d0 = digestOf(r.output);
  assert.ok(d0, `no digest: ${r.output}`);
  const card = join(d, "org/roles/b-ceo-office/ceo.role.yaml");
  appendFileSync(card, "# a comment changes bytes, not values\n");
  r = runNode(CAT, ["--digest", "--root", d]);
  assert.ok(r.output.includes(`digest: ${d0}`), `a comment moved the digest: ${r.output}`);
  mutate(card, sed(/^autonomy_ceiling: 'L1'$/, "autonomy_ceiling: 'L0'"));
  r = runNode(CAT, ["--digest", "--root", d]);
  const d1 = digestOf(r.output);
  assert.ok(d1, `no digest: ${r.output}`);
  assert.notEqual(d1, d0, "a value change did not move the digest");
});

test("org-chart: modes are exclusive and unknown flags refused, exit 2", () => {
  let r = runNode(CAT, ["--chart", "--digest"]);
  assert.equal(r.status, 2);
  assert.ok(r.output.includes("separate modes"), r.output);
  r = runNode(CAT, ["--chrt"]);
  assert.equal(r.status, 2);
  assert.ok(r.output.includes('unknown flag "--chrt"'), r.output);
});
