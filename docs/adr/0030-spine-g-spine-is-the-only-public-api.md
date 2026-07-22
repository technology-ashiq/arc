# ADR 0030 — SPINE-G: The spine is arc's only public API — one reader, per-consumer cursors, no bus

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** two-way
**Revisit trigger:** the first L3/scheduled process needs push semantics → the scheduler
BRIEF's pull trigger (policy engine prerequisite) fires; the same reader contract becomes
event-driven with zero consumer changes — that is the designed escape path, not a rewrite.

## Context

The orchestrator initiative's closing lesson: modules survive by coupling to contracts, not
internals. Every future module (engine, evolve, dashboard, policy) must plug into a stable
API. The temptation to add a pub/sub bus is named a rabbit hole in the design source.

## Options considered

1. **One reader lib/CLI (kind/since/venture filters) + per-consumer cursors, polling** — chosen.
2. **Pub/sub daemon / file-watcher bus** — rejected: no-go; a daemon on a laptop factory is
   an ops liability, and polling cursors deliver the same correctness for human-started runs.
3. **Consumers read `events/*.jsonl` / `state.db` directly** — rejected: couples every module
   to storage internals; forecloses the sqlite accelerator and any format evolution.

## Decision

The spine is arc's ONLY public API: one reader lib/CLI supporting `--kind`, `--since <ulid>`,
`--venture` filters; each consumer keeps its own **cursor** (last ULID seen) and catches up
from it; consumers declare what they read via `consumes:` in their product manifest. Direct
access to `events/*.jsonl` or `state.db` outside the reader is a lint violation — grep-lint
enters TRIAL as WARN-first (arc lint culture), promotion only via the retro/trial-ledger
process. NO pub/sub daemon, bus, or watcher — polling cursors now; a future scheduler makes
the same contract event-driven with zero consumer changes.

## Consequences

- REQ-09: brief/inbox code contains zero direct storage references; cursor catch-up is
  bats-proven.
- The reader is parser-class code → adversarial pass before any FAIL-mode trust.
- Ad-hoc human queries are NOT consumers — the sqlite3 CLI on derived state stays fine.
