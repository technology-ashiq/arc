# ADR 1720 — LAU-T: `payment` is two slots, test and live

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** Razorpay test mode refuses a purchase before activation pages are live

## Context

External review finding 2: the money phase depended on the legal phase through the activation checklist while the plan forbade reordering. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **One `payment` slot** — simple / phase order contradicts its dependency.
2. **`payment-test` (core) and `payment-live` (required, Cycle 2)**.

## Decision

Option 2. `payment-test`: test mode, emits `revenue.simulated`, no legal dependency. `payment-live`: `depends_on: [payment-test, legal-pages, invoices-gst, refunds]`, approval gate 3, exercised this cycle through its refusal path and never crossed.

## Consequences

The phase order stands because the dependency is written where the machine reads it.
