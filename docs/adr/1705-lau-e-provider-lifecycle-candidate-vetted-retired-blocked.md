# ADR 1705 — LAU-E: provider lifecycle is candidate, vetted, retired or blocked

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

A listed tool is not a proven tool. `vetted` must mean something a reader can check. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Listed = usable** — no ceremony / unproven tools in use.
2. **`vetted` needs four artifacts in one branch** — checkable / a vet costs a real run.

## Decision

Option 2. `vetted` requires a `/arc-capability` scout record, the slot's `verify` passing against the real provider at least once, a `decision.recorded` id the row carries (`vetted_by`), and the adapter `digest`. `blocked` requires a `reason`. `status` is intent; `last_verified` is observed and runner-written.

## Consequences

No slot is vetted by being listed in the catalog.
