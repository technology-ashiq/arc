# ADR 1714 — LAU-N: a venture is born with its teardown plan

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

A crashed apply can leave a provider resource nobody knows about (pre-mortem 5). Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Teardown written when needed** — late / resources forgotten.
2. **`teardown --plan` from `new`, refreshed by every apply, naming recorded resource ids**.

## Decision

Option 2. v1 renders; it never applies (`teardown --apply` is Cycle 2 behind gates).

## Consequences

Every resource id `scaffold()` reports lands in the plan.
