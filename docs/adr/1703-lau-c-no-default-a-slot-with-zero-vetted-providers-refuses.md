# ADR 1703 — LAU-C: no default, ever; a slot with zero vetted providers REFUSES

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** never — a fallback provider is the failure this rule exists to prevent

## Context

An implementer who reads the word default writes a fallback, and a fallback is a silent choice nobody made. Bench already holds that a missing ceiling is a refusal, never a default. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **A designated fallback per slot** — always runnable / a choice nobody made.
2. **REFUSED on zero vetted providers** — honest / a slot can block a board.

## Decision

Option 2. `plan` prints `REFUSED — no vetted provider for <slot>` and `apply` exits 2. The word `default` fails the `default-word` lint in both YAML files and in adapter code; the catalog says *initial candidate*.

## Consequences

A new venture board can be blocked by a slot with no vetted provider; that is the correct state, shown, not hidden.
