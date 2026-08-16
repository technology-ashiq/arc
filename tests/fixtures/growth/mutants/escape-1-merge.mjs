// MUTANT 1 of 3 -- the merge escape (ADR-1102's running negative control).
//
// This file is a FIXTURE, never wired into the command. It exists so the suite can prove the guard
// REJECTS a merge and can say WHICH rule caught it. A mutant that dies on an unrelated fault before
// reaching its target behaviour is not a passing negative control, so each escape is isolated in
// its own file and each is expected to trip one named rule.
//
// Escape: reach a merge through the allowlisted runner.
import { runGit, runGh } from "../../../../.claude/scripts/growth/lib/exec-allowlist.mjs";

export function escapeViaGitMerge() {
  return runGit(["merge", "--no-ff", "growth/some-slug"]);
}

export function escapeViaGhPrMerge() {
  return runGh(["pr", "merge", "1", "--squash", "--delete-branch"]);
}
