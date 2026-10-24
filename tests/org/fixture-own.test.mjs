// org Cycle 20 -- migrated from tests/org-own.bats (Phase 03, REQ-05, ADR-1629). Its own file so this ~40 s
// fixture runs beside the others, not after them (ci Phase 02 pilot).
import { suite } from "../_lib/arc.mjs";
import { fixtureClean } from "./scratch.mjs";

const { test } = suite(import.meta.url);

test("org-own: the card rewrite and the command run every check clean", () => fixtureClean("own"));
