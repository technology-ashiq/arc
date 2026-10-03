# ADR 1718 — LAU-R: the runner is durable and resumable

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a resume that doubles a provider resource

## Context

External review finding 7: mid-run crash, resource created but receipt unwritten, concurrency, timeout, resume after a gate, missing secret were all undefined. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **A workflow engine** — complete / the rabbit hole the spine avoided (rabbit hole 4).
2. **A state file, a lock, an idempotency key and a DAG walk**.

## Decision

Option 2. State in `.claude/state/launch/<slug>.json` (instance-only, never synced). Slot states `pending → planned → awaiting-approval → applying → applied → verified`, with `failed(reason)` and `skipped(predicate)` as terminals `apply` may re-enter. Idempotency key `venture@slot@provider@attempt`. `withLock` per venture. Per-slot `timeout` from the slots file. Fixtures for kill-mid-apply resume, concurrent refusal and timeout ship in Phase 00.

## Consequences

`apply` on a `verified` slot is a no-op that returns the same receipt id.
## Amendment (kickoff attack, 2026-10-03)

The locked key `venture@slot@provider@attempt` identifies an attempt's receipt; because `attempt` changes on every
retry it cannot dedupe a provider resource. `scaffold()` therefore also tags every resource it creates with the
stable `venture@slot@provider` and looks that tag up before creating, which closes the window between "provider
created it" and "state recorded it". The state file is written temp + rename; a lock left by a dead pid is taken
over by `withLock`'s existing pid check and the takeover is printed; a slot timeout aborts the adapter through an
`AbortSignal` that `ctx.fetch` honours.
