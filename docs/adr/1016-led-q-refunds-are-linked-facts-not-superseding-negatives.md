# ADR 1016 — LED-Q: a refund is a linked positive fact, not a superseding negative event

**Status:** accepted
**Date:** 2026-08-13
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a provider issues a refund that cannot be attributed to a single original
charge (a bulk or goodwill credit against an account rather than a payment), which `refund_of`
cannot express.

## Context

ADR-1007 (LED-H) and REQ-02 both say refunds "enter as superseding negative events, never edits".
Phase 0 implementation found that sentence describes something this spine cannot represent, for two
independent reasons discovered by reading the code rather than the plan:

1. **`amount` cannot be negative.** `assertMoney` in `.claude/scripts/hq/lib/validate.mjs` has
   required a *positive* safe integer in minor units since Cycle 2 REQ-03, and its rejection is
   pinned by `tests/spine-ingest.bats`. A negative revenue payload is refused before ledger sees it.
   A full refund would need `amount: 0`, which is refused too.
2. **`supersedes` means "this record replaces that one".** A refund does not replace the charge —
   the charge really happened, the customer really paid, and the fee was really taken. Superseding
   the original would erase a true economic fact from replay-derived state in order to record a
   second true one. Two facts, not a correction.

The plan's phrasing was written before either constraint was checked. This ADR amends the
mechanism; it does not touch the intent, which was that a refund never mutates a prior record.

## Options considered

1. **A refund is its own `revenue.received` carrying `refund_of`** — the namespaced
   `provider_payment_id` of the charge it refunds. `amount` stays positive and means the magnitude
   refunded; the ledger lib subtracts it at derivation.
2. **Relax `assertMoney` to permit negative amounts** — matches the plan's words, and changes a
   core money invariant of a shared organ that four other suites depend on, to serve one lane.
3. **Emit refunds under `supersedes`** — no schema change, and it deletes the charge from derived
   state, so a month's gross would silently shrink to its net.

## Decision

Option 1. `refund_of` joins the optional keys of the closed revenue payload schema (ADR-1002); it
is a `provider:token` id namespaced to the same provider, exactly like `provider_payment_id`. The
charge and the refund are both true records and both stay on the log.

This is also what makes REQ-02's currency rule implementable: because a refund names the charge it
refunds, the over-refund comparison can be made in the **original charge currency before any FX
conversion**, so a refund settling at a different day's rate cannot fire or suppress the flag on
rate movement alone. A free-floating negative event has nothing to compare against.

Over-refund detection is then arithmetic rather than a heuristic: sum the refunds pointing at one
charge and compare with that charge's `amount`. Exceeding it raises a needs-you flag, and is never
netted away.

## Consequences

Easier: the charge stays visible, so gross, fees and tax remain reportable for a month that later
saw a refund — which is what makes ADR-1004's "a closed month never restates" meaningful rather
than merely enforced. Over-refund and partial-refund logic is exact integer arithmetic.

Harder: a refund whose original charge is not on the spine is now an error rather than a
free-standing negative. That is correct — a refund of a payment we never recorded means the
ingest is incomplete, and it surfaces as a needs-you item instead of quietly reducing a total.

`refund_of` pointing at a charge with a different `provider` is refused, as is a refund pointing at
itself. Both are pinned as red fixtures.
