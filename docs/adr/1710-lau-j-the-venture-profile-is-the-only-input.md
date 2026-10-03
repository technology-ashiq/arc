# ADR 1710 — LAU-J: `venture.yaml` is the only input

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

Templates per venture type would become second catalogs. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Per-type templates** — familiar / two catalogs drift.
2. **One profile; templates derived as slot subsets**.

## Decision

Option 2. Fields: `slug · type · region · payment_model · tenancy · ai · compliance[] · honesty_class · brand`. Optional slots render `skipped (optional for <type>)`, never hidden.

## Consequences

A real venture differs from the rehearsal only by its profile.
