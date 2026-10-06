# ADR 1903 — DIS-C: `score.yaml` weights are owner-owned

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source (DIS-C). Fired by the owner ruling (ADR-1900). A weight that changes silently changes which venture gets built.

## Options considered

1. **evolve tunes weights directly.** Fast, but invisible.
2. **evolve may only PROPOSE.** The proposal is a diff carried in an `approval.requested`, and nothing applies it without a `decision.recorded`.

## Decision

Option 2. `products/discover/score.yaml` holds four weights: `pain_frequency · money_signal · buildability_2w · moat_hint`. Every score lists the evidence line ids it came from. The same input gives the same score.

## Consequences

Tuning is a YAML edit made by the owner and visible in git history.
