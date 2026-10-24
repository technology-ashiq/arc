// org Phase 00 -- the role card grammar (ADR-1601 / ADR-1609 / ADR-1614), through tests/org/probe.mjs.
// Migrated from tests/org-card.bats (ci Phase 02). The worked example must validate, and each single-field
// mutation of it must fail naming the field; the example itself is the negative control for all of them.
import assert from "node:assert/strict";
import { join } from "node:path";
import { ARC_ROOT, runNode, mutant, sed, suite } from "../_lib/arc.mjs";

const { test, registered, declared } = suite(import.meta.url);
const PROBE = join(ARC_ROOT, "tests/org/probe.mjs");
const EXAMPLE = join(ARC_ROOT, "org/schema/example-seo-strategist.role.yaml");
// a scratch card named after the example, with one sed-style edit that must change it
const card = (t, re, to) => mutant(t, EXAMPLE, sed(re, to));
const validate = (f) => runNode(PROBE, ["validate", ARC_ROOT, f]);

test("org-card: every test in this file is registered (none dropped by name)", () => {
  assert.ok(declared() > 0);
  assert.equal(registered(), declared(), `registered ${registered()} of ${declared()}`);
});

test("org-card: the worked example validates and is staffed", () => {
  const r = validate(EXAMPLE);
  assert.equal(r.status, 0, r.output);
  assert.equal(r.output, "VALID staffed=true");
});

test("org-card: a model string as the tier fails, naming the model", (t) => {
  const r = validate(card(t, /^ {2}tier: 'balanced-workhorse'$/, "  tier: 'claude-sonnet'"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('binds.tier names a model ("claude")'), r.output);
});

test("org-card: an unknown key fails, naming it", (t) => {
  const r = validate(card(t, /^autonomy_ceiling: 'L1'$/, "salary: '5'"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('unknown key "salary"'), r.output);
});

test("org-card: a hired seat cannot be legitimised by genesis", (t) => {
  const r = validate(card(t, /^legitimacy: 'interview:01ARZ3NDEKTSV4RRFFQ69G5FAV'$/, "legitimacy: 'genesis'"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("a hired seat cannot be legitimised by genesis"), r.output);
});

test("org-card: a third origin state is refused", (t) => {
  const r = validate(card(t, /^origin: 'hired'$/, "origin: 'converted'"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes("origin must be own or hired -- there is no third state"), r.output);
});

test("org-card: a KPI over a kind the spine does not have fails", (t) => {
  const r = validate(card(t, /^ {4}over: 'content.published'$/, "    over: 'content.viral'"));
  assert.equal(r.status, 1, r.output);
  assert.ok(r.output.includes('kpi over "content.viral" is not a spine kind'), r.output);
});

test("org-card: the emitter round-trips through the yaml subset", () => {
  const r = runNode(PROBE, ["roundtrip"]);
  assert.equal(r.status, 0, r.output);
  assert.equal(r.output, "ROUNDTRIP OK");
});

test("org-card: the emitter refuses a list item the subset would misread as a mapping", () => {
  const r = runNode(PROBE, ["emit-colon"]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.startsWith("REFUSED ") && r.output.includes("contains a key separator"), r.output);
});
