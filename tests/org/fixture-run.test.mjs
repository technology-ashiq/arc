// org Cycle 20 -- fixture programs that run every check themselves and print `RAN <name> ..., 0 failed`.
// Migrated from tests/org-dup-keys.bats (Phase 04, REQ-06, ADR-1630) and tests/org-own.bats (--assign from face
// Phase 13, ADR-1352). The two slow fixtures, own and skill-import, sit in their own files (ci Phase 02 pilot):
// node:test runs one file's tests in series and files in parallel.
import { suite } from "../_lib/arc.mjs";
import { fixtureClean } from "./scratch.mjs";

const { test } = suite(import.meta.url);

test("dup-keys: face-sections and face-coverage fail by name on each contract file holding a key twice", () => fixtureClean("dup-keys"));
test("org-own --assign: who sits a role, set on a branch with every refusal before any write (face Phase 13, ADR-1352)", () => fixtureClean("seat-assign"));
