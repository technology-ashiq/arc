#!/usr/bin/env node
/**
 * Probe for the fixture-repo harness (Phase 00 slice 06).
 *
 * Its own file rather than inline `node -e` in bats: these checks need apostrophes and `$` in
 * git porcelain strings and messages, and CLAUDE.md forbids all of those in a shell-embedded
 * program -- a rule this repo has broken four times.
 *
 * Exit 0 = every check held; any failure prints FAIL and exits 1, so the bats wrapper asserts
 * the probe RAN rather than asserting on the absence of a string, which a crash satisfies.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { materializeRepoState, repoStatus } from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = join(ROOT, "tests/fixtures/engine/evals/commit-msg-draft/repo-states/single-file-fix");
let failed = 0;
const check = (name, ok) => { if (!ok) { console.error(`FAIL ${name}`); failed++; } else console.log(`ok ${name}`); };
const threw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// ---- it materializes, and the base is a REAL commit -------------------------------------------
const { root, cleanup } = materializeRepoState(STATE);
try {
  check("the temp repo exists", existsSync(root));
  check("the base tree landed", existsSync(join(root, "src/total.mjs")));

  const log = execFileSync("git", ["log", "--oneline"], { cwd: root, encoding: "utf8" }).trim();
  check("the base is committed, exactly once", log.split("\n").filter(Boolean).length === 1);
  // git diff needs something to compare against; a base that was never committed would make
  // every fixture look like a fresh repo with no history.
  check("the commit is reachable as HEAD",
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim().length >= 7);

  // ---- THE LOAD-BEARING CHECK: the work overlay is UNSTAGED -----------------------------------
  const status = repoStatus(root);
  check("the working tree is dirty", status.length > 0);
  const line = status.split("\n").find((l) => l.includes("total.mjs")) || "";
  // Porcelain column 1 is the INDEX, column 2 the WORKTREE. An unstaged modification reads
  // " M"; a staged one reads "M ". If the harness had staged, the process would have nothing
  // left to decide -- and staging is its own declared job (git.op: add:*).
  check("the change is UNSTAGED, not staged", line.startsWith(" M"));
  check("the porcelain line names the overlaid file", line.includes("total.mjs"));

  // ---- the overlay actually replaced content, rather than sitting beside it -------------------
  const body = readFileSync(join(root, "src/total.mjs"), "utf8");
  check("the work tree overlaid the base content", body.includes("Array.isArray"));

  // ---- isolation: two materializations do not share a directory ------------------------------
  const second = materializeRepoState(STATE);
  check("a second materialization gets its own root", second.root !== root);
  second.cleanup();
  check("cleanup removes the second root", !existsSync(second.root));
} finally {
  cleanup();
}
check("cleanup removes the root", !existsSync(root));

// ---- tombstones: a work tree can express a DELETION --------------------------------------------
// `delete-and-add` is the one fixture where a draft built only from ADDED lines describes half
// the change. Copying cannot remove a file, so work/ marks one with `<path>.arc-deleted`.
{
  const del = materializeRepoState(join(ROOT, "tests/fixtures/engine/evals/commit-msg-draft/repo-states/delete-and-add"));
  try {
    check("the tombstoned file is gone from the work tree", !existsSync(join(del.root, "src/legacy-total.mjs")));
    check("the tombstone marker itself is gone too", !existsSync(join(del.root, "src/legacy-total.mjs.arc-deleted")));
    check("the added file is present", existsSync(join(del.root, "src/total.mjs")));
    const st = repoStatus(del.root);
    // Porcelain shows a worktree deletion as ` D` and an untracked add as `??`. Both must be
    // visible and UNSTAGED, or the process has nothing to stage and nothing to describe.
    check("the deletion is visible and unstaged", st.split("\n").some((l) => l.startsWith(" D") && l.includes("legacy-total.mjs")));
    check("the addition is visible as untracked", st.split("\n").some((l) => l.startsWith("??") && l.includes("total.mjs")));
  } finally { del.cleanup(); }
}

// ---- refusals ---------------------------------------------------------------------------------
check("a state with no base/ is refused", threw(() => materializeRepoState(join(ROOT, "tests/fixtures/bench/bad-state/no-base"))) !== null);
check("a state with no work/ is refused", threw(() => materializeRepoState(join(ROOT, "tests/fixtures/bench/bad-state/no-work"))) !== null);

// ---- the failure path does not leak a temp repo ----------------------------------------------
{
  const before = readdirSync(require$tmp()).filter((n) => n.startsWith("arc-bench-repo-")).length;
  threw(() => materializeRepoState(join(ROOT, "tests/fixtures/bench/bad-state/no-work")));
  const after = readdirSync(require$tmp()).filter((n) => n.startsWith("arc-bench-repo-")).length;
  // A harness that only cleans up on success fills the runner disk exactly when something is
  // already going wrong.
  check("a refused materialization leaks no temp repo", after === before);
}

function require$tmp() { return process.env.TMPDIR || process.env.TEMP || process.env.TMP || "/tmp"; }

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
