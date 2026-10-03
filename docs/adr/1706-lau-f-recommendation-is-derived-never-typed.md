# ADR 1706 — LAU-F: recommendation is derived, never typed

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

The owner asked for a suggestion per tool of which is best. A typed suggestion rots; a derived one shows its reasons. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **A hand-kept ranking** — simple / stale the day it is written.
2. **Fit rules × `venture.yaml` × provider rows, printed with rule ids** — explainable / rules must be written.

## Decision

Option 2 for v1. Receipt weighting is Cycle 2 behind its trigger (>= 2 vetted providers in a slot and >= 2 ventures with receipts). A tie or an owner-named doubt goes to `/arc-council`. An owner override is a `decision.recorded` the next `plan` cites.

## Consequences

Every recommendation line names the fit-rule ids that produced it.
