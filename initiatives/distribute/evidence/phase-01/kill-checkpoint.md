# Phase 01 — day-4.5 kill checkpoint (REQ-09)

Read on 2026-10-09 against the real repository. Answer: **YES — a gate failure cannot reach `main`.**

## The flip

The owner answered "flip now" on 2026-10-09. Before the PUT, the 19 contexts in `protection.json` were compared
with the check-run names on the newest `pull_request` run (PR #394 head): 19 of 19 matched, so no `STALE-CONTEXT`.
`gh api -X PUT repos/technology-ashiq/arc/branches/main/protection --input protection.json` returned
`enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`, `strict: true`, 19 contexts.
The GET afterwards is `protection-after.json`; `arc-doctor --repo` printed 5 `ok` (`doctor-repo-after.txt`).

## The planted PR

PR #395 (`feat/distribute-p01-planted`, head `17ba6f5b`) added `.claude/hooks/PreToolUse.d/99-planted.sh` with
no row in `engine/enforcement.yaml`. Run 37834419295: `ci-tier` success, **18 of 18 `selftest` jobs failed**
(`planted-pr-395-jobs.txt`), and `mergeStateStatus` read `BLOCKED` (`planted-pr-395-state.json`). The PR was
closed unmerged and its branch deleted on both sides.

**Which gate caught it.** The failing logs name `99-planted` through `product-lint` (`unmapped file (synced but
in no product)`, `planted-pr-395-log-ubuntu18.txt`), which stops every job before the bats suites run. So
`gate-parity` itself did not run on this PR. The owner accepted this on 2026-10-09: the checkpoint question is
whether a gate failure reaches `main`, and it did not. `gate-parity`'s own catch is proven separately by
`--mutant-selftest` on CI (REQ-01) and in the main clone (`caught 99-mutant`). Commit-time did not catch the
planted file either. That is by design, because `gate-parity` is a merge-time gate (ADR-2002).

## The direct push

From a fresh clone with no local hooks, an empty commit `b5e283e` was pushed with `git push origin HEAD:main`.
The server refused it: `GH006: Protected branch update failed for refs/heads/main ... 19 of 19 required status
checks are expected` (`direct-push-refused.txt`). `main` did not move.

## Live demo (main clone, `E:/Work_Hub/01_Automemory/arc` at `a9f7a0fa`)

`gate-parity: 9 fragments, 7 rules, 22 rows, 0 gaps` (`gate-parity-mainclone.txt`). That equals the census in
`fragment-census.md` (N = 9, M = 7).
