// org Cycle 20 -- migrated from tests/org-skill-import.bats (Phase 02, REQ-04, ADR-1628). Its own file so this
// ~75 s fixture runs beside the others, not after them (ci Phase 02 pilot).
import { suite } from "../_lib/arc.mjs";
import { fixtureClean } from "./scratch.mjs";

const { test } = suite(import.meta.url);

test("skill-import: the vet, the source and the command run every check clean", () => fixtureClean("skill-import"));
