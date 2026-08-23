# ADR 1400 — DSV-A: the composer seat changes only through EXP-A1, never by fiat

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** EXP-A1 returns a material owner-visible gain AND the owner explicitly
accepts the cost/time — the standing formula of [ADR-0070](0070-composer-seat-stays-balanced-workhorse.md).

## Context

[ADR-0070](0070-composer-seat-stays-balanced-workhorse.md) seated the composer at
balanced-workhorse after a paired A/B in which the owner's own blind ranking went **3–0**
against high-judgment. That ADR named its own revisit trigger: *a looser brief, a thesis
that does not pre-decide the structure, or a domain the composer must reason about rather
than lay out — and the owner dissatisfied on craft grounds rather than constraint grounds.*

That trigger has now fired. The owner scored lane output ~10/100 on craft (2026-08-23), and
design v2's regime — eyes, reference packs, a craft-first jury — is precisely the "materially
more room" case ADR-0070 recorded as untested.

## Options considered

1. **Permanently re-seat the composer to the strongest tier now** — pros: removes a suspected
   bottleneck immediately / cons: overturns a receipted decision on intuition, and the owner's
   own blind ranking is the evidence being overturned.
2. **Re-run ADR-0070's paired harness inside the new regime (EXP-A1)** — pros: the ADR's own
   prescribed path, settles the question with receipts either way / cons: costs 0.5d and
   defers the answer to Phase 04.

## Decision

Option 2. The seat moves only through EXP-A1, run on ADR-0070's same paired same-commit
harness, in the new regime, with the two deviations that run logged now fixed: a
**pre-registered prediction** and a **reference item present**. Promotion still requires the
standing formula — material owner-visible gain AND explicit cost/time acceptance.

A permanent re-seat by fiat would make a receipted formula decoration, which is the failure
mode [ADR-0064](0064-mp-b-seat-tier-principle-creative-seats-earn-their-tier.md) exists to
prevent.

## Consequences

Easier: the tier question closes with evidence rather than staying a standing argument.
Harder: nobody may adjust the composer's `model:` line before Phase 04 completes — under
`docs/adr/0069-balanced-model-policy.md` that line is a governed production tier change, not
a taste edit. What we would revisit: if EXP-A1 cannot be run at all (harness unusable in the
new regime), this ADR's path is blocked and the question returns to the owner unresolved.
