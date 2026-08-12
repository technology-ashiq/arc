#!/usr/bin/env node
/**
 * Probe for the armed commit-msg-draft class (Phase 00 slice 07).
 *
 * Its own file, not inline `node -e`: the assertions carry regexes full of apostrophes, `$` and
 * backslashes, all of which CLAUDE.md forbids in a shell-embedded program.
 *
 * THE CHECK THAT MATTERS is self-consistency: every fixture's own `expected` must satisfy its
 * own `assertions`. A fixture whose recorded expectation fails its own rules is asserting
 * something nobody could ever pass, and it would read as a permanent model failure.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_FIXTURES, coverageVerdict, readPack, scoreAssertions, validateAssertion } from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "tests/fixtures/engine/evals/commit-msg-draft");
const STATES = join(DIR, "repo-states");
const REPLAY = join(ROOT, "tests/fixtures/bench/mock-replay/commit-msg-draft");

let failed = 0;
const check = (name, ok) => { if (!ok) { console.error(`FAIL ${name}`); failed++; } else console.log(`ok ${name}`); };

const ARMED = ["single-file-fix", "new-feature-file", "docs-only", "multi-file-refactor", "delete-and-add"];

check(`${MIN_FIXTURES} is the floor`, MIN_FIXTURES === 5);
check("five fixtures are armed", ARMED.length === 5);

for (const id of ARMED) {
  const fx = JSON.parse(readFileSync(join(DIR, `${id}.json`), "utf8"));

  check(`${id}: names its repo state`, fx.repo_state === id);
  check(`${id}: input is empty, because the process declares inputs: []`,
    fx.input && Object.keys(fx.input).length === 0);
  check(`${id}: carries assertions`, Array.isArray(fx.assertions) && fx.assertions.length >= 5);

  // Shape first: an assertion that does not validate would throw at score time, mid-run.
  const bad = fx.assertions.map((a, i) => validateAssertion(a, `${id}[${i}]`)).filter(Boolean);
  check(`${id}: every assertion is well-formed`, bad.length === 0);
  if (bad.length) console.error(`  ${bad[0]}`);

  // THE self-consistency check.
  const s = scoreAssertions(fx.expected, fx.assertions, id);
  check(`${id}: its own expected satisfies its own assertions (${s.passed}/${s.total})`, s.passed === s.total);

  // The repo state must exist and have both trees, or the harness cannot pose the case.
  check(`${id}: has a base tree`, existsSync(join(STATES, id, "base")));
  check(`${id}: has a work tree`, existsSync(join(STATES, id, "work")));

  // And a recording, so bench's own suite can replay this fixture offline at zero cost.
  check(`${id}: has a mock recording`, existsSync(join(REPLAY, `${id}.json`)));
}

// Every armed state must DIFFER from every other, or they are five samples of one case -- the
// K dimension wearing five names. Compare the work trees by content.
{
  const sig = (id) => {
    const d = join(STATES, id, "work");
    const walk = (p, acc) => {
      for (const e of readdirSync(p, { withFileTypes: true })) {
        const q = join(p, e.name);
        if (e.isDirectory()) walk(q, acc);
        else acc.push(`${e.name}:${readFileSync(q, "utf8").length}`);
      }
      return acc;
    };
    return walk(d, []).sort().join("|");
  };
  const sigs = ARMED.map(sig);
  check("all five work trees differ from one another", new Set(sigs).size === 5);
}

// The pack, and the floor flipping.
{
  const pack = readPack(join(DIR, "pack.json"));
  check("the pack names its task class", pack.task_class === "commit-msg-draft");
  check("the pack carries a revision", typeof pack.revision === "string" && pack.revision.length > 0);

  const declared = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "pack.json").length;
  check(`commit-msg-draft now ships ${declared} fixtures, at or above the floor`, declared >= MIN_FIXTURES);
  check("commit-msg-draft is now coverage-eligible", coverageVerdict("commit-msg-draft", declared).eligible === true);

  // The other two classes stay honestly below the floor -- by design, not by defect.
  const v = coverageVerdict("review-diff", 1);
  check("review-diff still reads NO PROPOSAL", v.eligible === false);
  check("and the reason names the counts", v.reason.includes("1 of 5"));
}

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
