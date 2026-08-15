// MUTANT 2 of 3 -- the default-branch push escape.
//
// A fixture, never wired into the command. Four shapes, because "push to main" has more than one
// spelling and a guard that only knows the obvious one is a guard with a hole:
//   - the literal `push origin main`
//   - the BARE `git push`, which pushes the current branch to its upstream (the default branch,
//     when one is checked out) and names nothing at all
//   - a refspec whose DESTINATION is main while its source is a feature branch
//   - a force push
import { runGit } from "../../../../.claude/scripts/growth/lib/exec-allowlist.mjs";

export function escapeViaPushMain() {
  return runGit(["push", "origin", "main"]);
}

export function escapeViaBarePush() {
  return runGit(["push"]);
}

export function escapeViaRefspec() {
  return runGit(["push", "origin", "growth/some-slug:main"]);
}

export function escapeViaForce() {
  return runGit(["push", "--force", "origin", "growth/some-slug"]);
}
