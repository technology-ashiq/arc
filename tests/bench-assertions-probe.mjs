#!/usr/bin/env node
/**
 * Probe for the bench assertion substrate (Phase 00 slice 04).
 *
 * This lives in its OWN FILE rather than inside `node -e` in the bats file, because the checks
 * below need apostrophes, backticks and `$` in regexes and messages -- and CLAUDE.md is explicit
 * that a program embedded in a shell string carries none of those. That rule has been broken
 * four times in this repo, twice inside the comment explaining the previous break.
 *
 * Exit 0 = every check held. Any failure prints FAIL and exits 1, so the bats wrapper can assert
 * it RAN (exit status) rather than assert on the absence of a string, which a crash satisfies.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MISSING, MIN_FIXTURES, OPS, coverageVerdict, readPack, resolvePath, scoreAssertions, validateAssertion,
} from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (name, ok) => { if (!ok) { console.error(`FAIL ${name}`); failed++; } else console.log(`ok ${name}`); };
const threw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// ---- the op set is closed, and closed means enumerable -------------------------------------
check("op set is exactly the five ADR-0905 ops",
  JSON.stringify(Object.keys(OPS).sort()) === JSON.stringify(["absent", "contains", "equals", "length_between", "matches"]));

// ---- an unknown op is REFUSED, never skipped -----------------------------------------------
// `regex` is the plausible near-miss for `matches`. A scorer that skipped it would report a
// perfect assertion rate for a fixture that checked nothing.
{
  const why = validateAssertion({ id: "A-01", op: "regex", path: "a", value: "x" });
  check("unknown op is refused", typeof why === "string" && why.includes("unknown op"));
  check("refusal names the op and the id", why.includes("regex") && why.includes("A-01"));
}

// ---- value shape is validated per op --------------------------------------------------------
check("absent takes no value", validateAssertion({ id: "A", op: "absent", path: "a", value: 1 }) !== null);
check("absent is valid without a value", validateAssertion({ id: "A", op: "absent", path: "a" }) === null);
check("length_between demands two integers", validateAssertion({ id: "A", op: "length_between", path: "a", value: 5 }) !== null);
check("length_between rejects MIN > MAX", validateAssertion({ id: "A", op: "length_between", path: "a", value: [9, 2] }) !== null);
check("length_between accepts a pair", validateAssertion({ id: "A", op: "length_between", path: "a", value: [1, 9] }) === null);
check("matches rejects an invalid regex", validateAssertion({ id: "A", op: "matches", path: "a", value: "[" }) !== null);
check("equals requires a value", validateAssertion({ id: "A", op: "equals", path: "a" }) !== null);

// ---- dot-path resolution, numeric indices ---------------------------------------------------
const doc = { commits: [{ sha: "4936371", subject: "feat(x): y" }] };
check("resolves a nested indexed path", resolvePath(doc, "commits.0.subject") === "feat(x): y");
check("an out-of-range index is MISSING", resolvePath(doc, "commits.9.sha") === MISSING);
check("an unknown key is MISSING", resolvePath(doc, "commits.0.nope") === MISSING);
check("an empty path is MISSING", resolvePath(doc, "") === MISSING);

// ---- THE ZERO-DENOMINATOR RULE --------------------------------------------------------------
// The load-bearing one. A fixture with no assertions must report ABSENT, not 100%.
{
  const s = scoreAssertions(doc, undefined);
  check("no assertions contributes 0 to the denominator", s.total === 0 && s.passed === 0);
  check("no assertions reports an ABSENT rate, not 100 percent", s.rate === null);
}

// ---- scoring, and a failing path does not error ---------------------------------------------
{
  const s = scoreAssertions(doc, [
    { id: "A-01", op: "matches", path: "commits.0.subject", value: "^(feat|fix)\\(.+\\): .+" },
    { id: "A-02", op: "matches", path: "commits.0.sha", value: "^[0-9a-f]{7,40}$" },
    { id: "A-03", op: "absent", path: "commits.0.author" },
    { id: "A-04", op: "length_between", path: "commits", value: [1, 3] },
    { id: "A-05", op: "equals", path: "commits.0.sha", value: "deadbee" },
  ]);
  check("five assertions scored", s.total === 5);
  check("four pass and the wrong-sha one fails", s.passed === 4 && s.results.find((r) => r.id === "A-05").pass === false);
  check("rate is a real fraction", Math.abs(s.rate - 0.8) < 1e-9);
}
check("an unresolved path fails rather than throwing",
  scoreAssertions(doc, [{ id: "A", op: "equals", path: "nope.0.x", value: 1 }]).passed === 0);
check("a duplicate assertion id is refused", threw(() => scoreAssertions(doc, [
  { id: "A", op: "equals", path: "a", value: 1 }, { id: "A", op: "equals", path: "b", value: 2 },
])) !== null);

// ---- the pack manifest ----------------------------------------------------------------------
{
  const pack = readPack(join(ROOT, "tests/fixtures/engine/evals/commit-msg-draft/pack.json"));
  check("pack carries a revision", pack.revision === "1.0.0");
  check("pack carries its task class", pack.task_class === "commit-msg-draft");
}
check("a pack without a revision is refused",
  threw(() => readPack(join(ROOT, "tests/fixtures/bench/bad-pack/no-revision.json"))) !== null);

// ---- the per-class floor ---------------------------------------------------------------------
check("MIN_FIXTURES is 5", MIN_FIXTURES === 5);
check("a class at 1 fixture is not eligible", coverageVerdict("review-diff", 1).eligible === false);
check("the reason names the counts", coverageVerdict("review-diff", 1).reason.includes("1 of 5"));
check("a class at 5 fixtures is eligible", coverageVerdict("commit-msg-draft", 5).eligible === true);

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
