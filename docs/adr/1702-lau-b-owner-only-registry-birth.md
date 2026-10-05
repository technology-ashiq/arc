# ADR 1702 — LAU-B: a provider row is born only by the owner

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

A machine that can add its own permitted tools has no permission model. `design.sources.yaml` already set this law (ADR-1408). Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Machine-proposed rows land directly** — fast / no permission model.
2. **`approved_by` on every row, linted against the owner** — the ADR-1408 law reused / the owner writes each row.

## Decision

Option 2. Scans and absorb may propose a row as `idea.captured`; a row exists only when the owner writes it, and `launch-lint` fails a row whose `approved_by` is not the owner.

## Consequences

The machine never widens its own tool set.
