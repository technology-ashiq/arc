# ADR 1708 — LAU-H: zero new spine kinds; three approval gates

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a launch fact that no existing kind can carry without lying

## Context

The spine's kinds are closed (ADR-0026); a new kind needs its own ADR. A slot run is a run. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **New `launch.*` kinds** — explicit / extends a closed set.
2. **`run.completed` with `process: launch@x.y.z`**, `approval.requested` for gates, `decision.recorded` for picks.

## Decision

Option 2. Payload `{slot, provider, outcome, honesty_class, attempt}`. Gates: domain purchase (1), payment-live keys (3), first production deploy (2). The `hq.policy.yaml` row for `process:launch` lands in the same change as the first emission (POL-I).

## Consequences

The ledger, the brief and the face read launch receipts with no change.
