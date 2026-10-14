# ADR 0916 — a CLI driver works in its work root, and bench stops when the arc checkout moves

**Status:** accepted
**Date:** 2026-10-14
**Product:** `bench` (touches `engine` drivers by exception, recorded here)
**Reversibility:** two-way
**Revisit trigger:** a driver gains a reason to run its CLI somewhere other than the work root, or a
bench run must share its checkout with another writer.

## Context

The re-run after ADR-0915 started from the main clone on 2026-10-14. The contract fix worked: every
captured answer passed the schema and carried no `branch` key. But the commit subjects in those
answers named bench's own evidence files, which a fixture repo does not contain.

The benched model was working inside the arc checkout. Sonnet, holding Bash, created
`feat/bench-phase03-evidence` in the owner's main clone and committed there once per attempt: 11
commits in 7 minutes, each signed `Co-Authored-By: Claude Sonnet 5.5`. arc's own `SessionEnd` hook
then appended a session-log entry for each one, which only loads when the CLI's project is arc. The
run was stopped by hand after the first check. The earlier sonnet attempts left the same kind of
commit on `feat/council-sessions-bench-evidence`.

The cause is one line, repeated in two drivers. ADR-0220 split the run's two roots: `ARC_ROOT` stays
arc, the machinery, and the work root reaches the driver as `ARC_WORK_ROOT` plus the cwd arc-run
spawns it in. `claude-code.mjs` and `codex.mjs` still computed `WORK_ROOT = ARC_ROOT || cwd`, and
spawned their CLI there. `ARC_ROOT` is always set, so the work root was always arc. Every check
bench had passed: arc-run validated the work root (a fixture repo outside arc, its own toplevel),
and the router SHA was unchanged, because nothing touched the router.

No test caught it because none asked where the CLI ran. The fake CLI answers the same from any
directory. ADR-0915's isolation note ("for bench that is the materialized fixture repo, with no
`.claude/`") was written on the same false belief, so arc's project hooks were in fact loading.

## Decision

- **Both CLI drivers take `ARC_WORK_ROOT`, falling back to their cwd.** `ARC_ROOT` stays the
  machinery root, as ADR-0220 intended. `mock` keeps reading `ARC_ROOT`, correctly: its recordings
  live in arc. `hermes` runs in a container and `generic-api` has no tools, so neither has a cwd
  that matters.
- **Bench fingerprints the arc checkout and checks it after every attempt, and once more at the
  end.** The fingerprint is HEAD, the branch HEAD names, this worktree's HEAD reflog, the content
  of every tracked file that differs from HEAD, and the local config, less the other branches'
  sections in it. It is scoped to the
  worktree, not the repository: the owner runs parallel sessions in sibling worktrees that share
  branches, tags, the stash, the worktree list and the one config file, and any of those in the digest would void a
  paid run whenever another lane committed or fetched. The reflog catches a model that commits and
  resets back; file content, not a status code, catches an edit to an already-dirty file.
  Untracked files are left out, because bench writes its captures into the tree. The first attempt
  that moves it stops the run: its capture is not written, no further attempt is admitted, the
  remaining fixtures are recorded as unselected with the reason, and the run exits partial, saying
  it is not evidence. A read that fails twice stops the run the same way, as "could not be
  checked", rather than comparing a sentinel string as if it were state. Reads run with
  `GIT_OPTIONAL_LOCKS=0`, so the check never takes the owner's index lock.
- **The fingerprint is a tripwire for an accident, not a boundary against a model hiding its
  tracks.** Containment is the driver running in the work root. Not covered: a branch made
  without HEAD moving, a reflog expired after the fact, and anything outside this worktree.
- **The work root is resolved to an absolute path** in both drivers, so a relative value cannot
  mean one directory to the spawn and another to a later read.
- **Two tests pin it.** `engine-driver-contract.bats` runs both drivers through arc-run with
  `--work-root` and checks that the CLI ran there and not in arc, with a control run where it does
  land in arc. `bench-seal-probe.mjs` adds MUTANT C, a mock driver that makes a branch in
  `ARC_ROOT`: the run stops after one attempt, names the moved checkout, and leaves one arc-run
  receipt rather than three, against a clean git sandbox that moves nothing.

## Consequences

**Easier:** a benched model works in the fixture repo the score is computed from, which is the
only place its commits mean anything. ADR-0915's isolation claim becomes true: the CLI's project is
the fixture repo, which has no `.claude/`.

**Harder:** a bench run now needs its checkout to itself. Another session committing in the same
clone during a run stops it. That is the correct reading, because the run can no longer tell that
commit from its own model's.

**The partial runs are void.** `champion-sonnet` (2026-10-14, early) and `champion-sonnet2` measured
a model answering about the arc repo, not the fixture. Their captures are not evidence and are not
committed. The stray branches in the main clone are local, unpushed and hold only model commits;
the owner decides whether to delete them.

## Correction (2026-10-14, the first re-run after the merge)

The first champion re-run stopped itself after two attempts, and the fingerprint was right to the
letter and wrong in scope. The building session had run `checkout -b <name> origin/main` in a sibling
worktree, which writes `branch.<name>.remote` and `.merge` into the one config file every worktree
shares. `config --local` read that file whole. HEAD, the branch and the reflog were untouched, and
both completed attempts were real fixture commits. The config component now drops every
`branch.<name>.` section except this worktree's own branch; everything else in the file still
counts. The probe pins both sides. The stopped run, `champion-sonnet3`, is void like the two before it.
