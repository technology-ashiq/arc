# ADR 2020 — a foreign-harness session stamps its receipts and writes to the canonical spine

**Status:** accepted
**Date:** 2026-10-13
**Product:** `distribute` (touches `hq`'s `arc-event.mjs`; the owning lane is IDLE)
**Reversibility:** two-way
**Why two-way:** two optional environment variables; unset, emit is byte-identical to today
**Revisit trigger:** a receipt from an OpenCode session lands without `payload.harness`, a receipt lands on a spine other than the main clone's, or a second foreign harness needs a stamp.

## Context

REQ-03 counts receipts carrying `harness: opencode` with `evidence` pointing at a committed transcript. Nothing in `.claude/scripts/hq/` sets `harness`; the Cycle 1 spike only had it because a hand-written payload file put it there, and its receipt then mislabelled the command because that file went stale (`evidence/phase-00/opencode-spike.txt`). The rendered `arc-commit`, `arc-review` and `arc-ship` emit `commit.done`, `review.completed` and `ship.done` with payloads the model writes. A weak model writing `"harness":"opencode"` into every payload by hand is the same failure waiting to recur.

Second, `spineRoot()` refuses a linked worktree (`spine-io.mjs` `assertNotLinkedWorktree`) because a worktree's spine is one nobody reads. The owner's main clone sits on `main` with the owner's own uncommitted files and other sessions running; checking a branch out there for an OpenCode session would disturb all of them.

## Options considered

1. **The rendered OpenCode commands carry `"harness":"opencode"` in their emit lines.** A render rule that rewrites prose payloads; the model can still drop the field.
2. **Run the session in the main clone.** Satisfies the worktree guard and disturbs the owner's checkout and every session sharing it.
3. **`arc-event.mjs` stamps from two environment variables the wrapper (ADR-2019) sets, and the wrapper names the canonical spine explicitly.**

## Decision

Option 3.

- **`ARC_HARNESS`.** When set, `emit` writes `payload.harness = ARC_HARNESS` if the payload has no `harness` key, and refuses with `HARNESS_MISMATCH` if it has a different one. Grammar `[a-z][a-z0-9-]{0,31}`; anything else is `BAD_HARNESS`.
- **`ARC_EVIDENCE`.** When set and `--evidence` is absent, it is the receipt's `evidence`, validated by the same `assertEvidencePath` as the flag.
- **The spine.** The wrapper sets `ARC_SPINE_ROOT` to `<dirname(git common dir)>/.claude/state/hq`, computed from git in the session's working directory, never typed, and prints it in the transcript header. That is exactly the spine the worktree guard's own error message tells the caller to use. The guard is unchanged; the wrapper is the one declared, reviewable caller that names the spine, which is the act `spine-io.mjs` says a reviewer must be able to see.
- The wrapper sets `ARC_HARNESS=opencode`, `ARC_EVIDENCE=<transcript path relative to the repo root>` and `ARC_MODEL=<model>`.

## Consequences

- Every receipt from a wrapped session carries the harness and the transcript without the model's help; one the model mislabels is refused instead of landing.
- Unset, nothing changes: Claude Code sessions emit exactly as before, and a bats arm asserts that byte-for-byte on a fixed `ARC_SPINE_NOW`/`ARC_SPINE_RAND`.
- The evidence path names a file that is committed later in the same branch; the validator checks shape, not existence, so the phase close checks existence on the merged tree.
