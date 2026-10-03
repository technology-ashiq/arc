# ADR 1717 — LAU-Q: slots carry a tier and a condition

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a core slot that cannot close without a non-core one

## Context

External review finding 1: 85 slots, not 48; required split into what v1 proves and what a launch needs. Finding 3: `payment_model: none` had no rule. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **One flat required list** — simple / v1 unbounded.
2. **`tier: core | required | optional` + `required_when` predicates**.

## Decision

Option 2. A slot whose predicate is false renders `skipped (<predicate>)`. The lint forbids a `depends_on` edge from a `core` slot to a non-core slot, and requires the DAG acyclic with every edge resolving.

## Consequences

The steel thread can never need Cycle 2 to close.
