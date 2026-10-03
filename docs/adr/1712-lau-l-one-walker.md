# ADR 1712 — LAU-L: one walker; launch-coverage imports face-coverage's walkers

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

A third inventory of slots drifts (DOC-A, ORG-J precedent). Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Own walker** — independent / a twin to keep in step.
2. **Import the walkers from `face-coverage.mjs`**.

## Decision

Option 2. Slots and providers are enumerated from the two YAML files and the `providers/` tree only.

## Consequences

Counts in any document are seeds; `launch-coverage` is the truth.
