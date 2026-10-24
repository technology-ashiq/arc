# ADR 2211 — Migration runs as parallel workers on owner-named models, trusted only through mechanical guards

**Status:** accepted
**Date:** 2026-10-24
**Product:** `ci`
**Reversibility:** two-way
**Revisit trigger:** the §11 second kill arm: both pilot models fail `migrate-guard` on first push, and both have a weakened assertion found in review.

## Context

Locked letter CI-R. ~4,700 tests remain after `org`. ADR-0069 b1 forbids automatic model switching.

## Options considered

1. **Opus migrates everything.** This has the highest cost.
2. **Parallel workers** (1 worker = 1 lane = 1 worktree = 1 `migrate/<lane>` branch = 1 PR, ≤ 5 at once) through the owner's OmniRoute / OpenRouter, on models the owner names per run.

## Decision

Option 2. The owner names every model, so it is a human choice, not a switch, and ADR-0069 b1 holds. Workers are trusted only through `migrate-guard`'s mechanical table (path, count, name map, assertion density ≥ 90%, skip ban, both green). Opus keeps the Phase 02 harness and template, the heavy files and the merge-time-pinned files, every worker PR's review with one negative control, and any fix a review sends back. Fan-out starts only after the D.6 pilot scorecard.

## Consequences

Each run records `lane · harness · model slug · start/end · tokens/cost` in its `MIGRATED.md` header.

## Amendment 2026-10-24 (`/arc-change`, owner)

The owner named the pilot models: **X = `claude-sonnet-5-5` on `spine`, Y = `claude-haiku-5-5` on `jobs`**, run in
Claude Code on the owner's subscription, not through OmniRoute. The gateway was there for cost; on the subscription
there is no per-token cost, so each `MIGRATED.md` header records **usage-limit % consumed** in place of `$`. The
shared quota is the new constraint: the pilot's usage figure sets how many workers fan out at once (≤ 5 still holds).
A-06 (tool calls through a gateway) no longer applies. The guards, the Opus review and the negative control are unchanged.
