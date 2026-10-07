# ADR 2013 — DST-M: commit-time is `core.hooksPath .githooks/`, zero dependency, and it is the second line

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** a worktree or the main clone is found with its hooks silent while `core.hooksPath` is set (A-04). DST-M then flips to a hook manager, recorded as a superseding ADR. Merge-time is unaffected by construction.

## Context

There is no git hook today: no `core.hooksPath`, no `.githooks/`, no husky and no lefthook (read 2026-10-07). There is also no root `package.json`, so a Node hook manager would bring the repo's first runtime dependency. The owner works across 17 worktrees and the main clone, on Windows. Cited from ADR-2000.

## Options considered

1. **`core.hooksPath .githooks`** — zero dependency, and a relative path resolves against each worktree's own root. One `git config` sets it, which `arc init` runs. Bypass: `git config --unset core.hooksPath`, or `git commit --no-verify`.
2. **A hook manager (husky / lefthook)** — familiar, with install scripts. But it adds a dependency, its install runs on `npm install` (which CI never runs at root), and it can be bypassed the same way with `--no-verify`.

## Decision

Option 1. `.githooks/pre-commit` and `.githooks/pre-push` are POSIX `sh` scripts. Each calls **the same** fragment scripts that the Claude hooks call (DST-B) and nothing else. Neither holds rule logic of its own. **The attacker's bypass finding is recorded as accepted:** `--no-verify` and `--unset` both silence commit-time. That is exactly why ADR-2002 makes merge-time the truth, and why this decision chooses only the *second* line. `doctor` prints whether `core.hooksPath` is set in the current worktree.

## Consequences

`core.hooksPath` is written to the shared `.git/config`, so it applies to every worktree. Because the path is relative, each worktree runs its own branch's `.githooks/`. Git for Windows runs `sh` hooks through its bundled bash. Phase 01 checks this on the owner's machine and in a Windows CI leg.
