# ADR 1010 — LED-K: natural-key duplicate detection lives in the derived layer, beside content-idem

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** a provider is ingested whose payment id is not stable across its own export
formats, making `provider_payment_id` a false key rather than a natural one.

## Context

The spine already deduplicates by **content**: the same payload emitted twice produces one receipt,
verified in Cycle 2. That protects against a repeated emission of identical bytes.

It does not protect against the same payment arriving in two *different representations* — once
typed by hand from a dashboard, once parsed from an export file, with a different field order,
a rounded fee, or a slightly different timestamp. Content-idem sees two distinct payloads, because
they are two distinct payloads. The money is counted twice.

## Options considered

1. **Detect in the derived layer on `provider_payment_id`; flag and exclude from totals pending a
   human decision.**
2. **Extend the spine's idem preimage to include `provider_payment_id`** — makes the spine reject
   the second one. It also changes idem semantics for every kind, and a hash-preimage change
   silently invalidates outstanding commitments (retro 2026-08-09, arc-absorb).
3. **Trust the reconciliation gate to catch it** — it will, at close, in the excess direction. That
   is a month of a wrong running total, and the gate should be the second net, not the first.

## Decision

Option 1. The derived layer detects the same `provider_payment_id` on more than one event, raises a
**needs-you flag**, and **excludes the duplicate from totals pending a human decision** — it does
not guess which one is real. C2's content-idem stays untouched.

The reason that carried the most weight: this is a derived observation about the data, not a
property of the log, and putting it in the log would change a mechanism that many other kinds
depend on in order to fix a problem only ledger has.

## Consequences

Easier: double-counting surfaces on the next render rather than at month end, and the spine's
idem semantics are left alone.

Harder: a flagged duplicate makes totals provisional until a human resolves it — which is correct,
and is why it is a needs-you item rather than a silent auto-pick.

Excluding rather than netting matters: silently keeping "the first one" would make the render
correct by luck when the second is the accurate record.
