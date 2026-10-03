# ADR 1704 — LAU-D: the adapter contract is four functions and no logic

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a provider whose exit proof needs a fifth function

## Context

Adapters are where business logic leaks first, and an adapter with logic cannot be swapped by one file. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **A provider SDK abstraction** — rich / the 12-way split rejected at solo scale (rabbit hole 2).
2. **`scaffold(ctx) · envContract() · verify(ctx) · teardown(ctx)`** — swappable / thin.

## Decision

Option 2. An adapter may write files under the venture repo root, call hosts in its row's `hosts[]`, and read the profile. It may not import venture application code, hold business rules, or decide anything a slot's exit criteria do not ask. `scaffold()` is check-then-create and reports `resources[]`.

## Consequences

`adapter-lint` enforces the import boundary. A resumed run never doubles a resource.
