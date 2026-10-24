# ADR 2210 — `.github/` write access for this cycle only

**Status:** accepted
**Date:** 2026-10-24
**Product:** `ci`
**Reversibility:** two-way
**Revisit trigger:** the cycle closes (REQ-08). If the deny is not restored by then, the close is refused.

## Context

Locked letter CI-Q. `.claude/settings.json:61-62` denies `Edit`/`Write` on `.github/workflows/**`, and ADR-2016 exists because of that deny. A session cannot edit `settings.json` (deny floor).

## Options considered

1. **Route every workflow change through owner pastes.**
2. **The owner lifts the deny for this cycle and restores it at close.**

## Decision

Option 2. Lifting and restoring the deny are owner actions, one line each. The restore is part of REQ-08.

## Consequences

Phase 00 cannot start until the deny is lifted, and that is the first item of its owner prep.
