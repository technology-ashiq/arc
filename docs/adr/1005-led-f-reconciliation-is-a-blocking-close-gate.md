# ADR 1005 — LED-F: reconciliation is a blocking close gate, both directions, per rail

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** the gate blocks a close for a discrepancy that turns out to be structural and
unfixable (a provider that reports a different period than it settles), which would make the gate
a permanent blocker rather than a net.

## Context

Every payment reaches the spine because a human put it there. Humans miss some and enter others
twice. Without a periodic check against an independent source, both errors are discovered months
later, if ever — and by then the months they belong to are the ones being reported.

The independent source already exists: the provider's own total for the period.

## Options considered

1. **Blocking gate at close, both directions, per rail** — a month cannot freeze while the spine
   and the provider disagree.
2. **Reconciliation report, advisory** — prints the difference and closes anyway. Retro
   2026-07-30 (arc-design-cycle3) is explicit that a pass condition which is only an absence
   cannot detect insufficiency; an advisory line is read once and then never again.
3. **Reconcile only shortfalls** — catches missed payments and is blind to double-counting, which
   is the error that inflates revenue and therefore the one most likely to be believed.

## Decision

Option 1. `arc pnl --close YYYY-MM` requires per-rail reconciliation input — a provider export sum
or a manually entered provider total (ADR-1015 pins how both are supplied) — and **blocks the
close in either direction**:

- spine < provider (shortfall) → lists missing-payment candidates
- spine > provider (excess) → lists duplicate suspects by `provider_payment_id`

Only a green reconciliation emits `month.closed`.

The reason that carried the most weight: this gate is the safety net under every ingest mistake
made between now and each close, and a net that can be stepped over is decoration.

## Consequences

Easier: ingest errors surface within a month of being made, while the provider record is still
easy to pull and the memory of the payment is still fresh.

Harder: closing a month requires having the provider's number to hand — a real chore, deliberately
placed where it is cheapest.

The gate's own failure mode is named by retro 2026-07-28 (arc-cycle2): an instrument anomaly
explained away with a plausible story instead of tested. A discrepancy is not permitted a benign
explanation in prose — it is resolved into named candidate events or the close does not happen.

"Rail" means one provider account settling into one currency; `razorpay` and a merchant-of-record
account are two rails, and each reconciles separately against its own total.
