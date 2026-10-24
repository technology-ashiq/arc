// org Cycle 20 -- the four fixture programs that run every check themselves and print `RAN <name> ..., 0 failed`.
// Migrated from tests/org-dup-keys.bats (Phase 04, REQ-06, ADR-1630), tests/org-own.bats (Phase 03, REQ-05,
// ADR-1629; --assign from face Phase 13, ADR-1352) and tests/org-skill-import.bats (Phase 02, REQ-04, ADR-1628).
import assert from "node:assert/strict";
import { join } from "node:path";
import { ARC_ROOT, runNode, suite } from "../_lib/arc.mjs";

const { test } = suite(import.meta.url);
// the fixture RAN (its banner) before its count is believed, then the exit status
function clean(name) {
  const r = runNode(join(ARC_ROOT, `tests/org/${name}.mjs`));
  assert.ok(r.output.includes(`RAN ${name} `), `the fixture never ran: ${r.output}`);
  assert.ok(r.output.includes(", 0 failed"), r.output);
  assert.equal(r.status, 0);
}

test("dup-keys: face-sections and face-coverage fail by name on each contract file holding a key twice", () => clean("dup-keys"));
test("org-own: the card rewrite and the command run every check clean", () => clean("own"));
test("org-own --assign: who sits a role, set on a branch with every refusal before any write (face Phase 13, ADR-1352)", () => clean("seat-assign"));
test("skill-import: the vet, the source and the command run every check clean", () => clean("skill-import"));
