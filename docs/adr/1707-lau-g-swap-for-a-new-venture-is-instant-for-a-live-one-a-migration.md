# ADR 1707 — LAU-G: a swap for a new venture is instant; for a live venture it is a migration

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

The registry decides what a new board gets. Changing a running venture's database is a data move, not a row edit. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **`migrateFrom()` in v1** — complete / no live venture exists to test it.
2. **Live swap = a venture-side `/arc-change` with its own ADR**; `migrateFrom()` waits for the first live venture that asks.

## Decision

Option 2.

## Consequences

v1 never moves a running venture's data.
