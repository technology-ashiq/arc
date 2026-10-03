# ADR 1711 — LAU-K: the arc wiring block is a slot group and runs last-but-one

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

A venture must appear on PORTFOLIO, the ledger and the face; hand-written rows rot (ADR-1018). Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Hand wiring after launch** — flexible / forgotten.
2. **Wiring slots with receipt-or-named-ABSENT**.

## Decision

Option 2. Passport through `venture-register` (`--dry-run` for a rehearsal), ledger source, face room, teardown plan in v1; team manifest, ops row, growth config in Cycle 2.

## Consequences

An unwired item is a named ABSENT with its reason.
