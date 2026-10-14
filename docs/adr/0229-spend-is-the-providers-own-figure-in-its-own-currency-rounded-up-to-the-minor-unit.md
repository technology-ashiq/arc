# ADR 0229 — Spend is the provider's own figure, in its own currency, rounded UP to the minor unit

**Status:** accepted
**Date:** 2026-10-14
**Product:** engine
**Reversibility:** one-way
**Revisit trigger:** the ledger lane adopts a sub-minor money unit, OR the Money room's measured total for one month
over-states the sum of the receipts' exact `provider_amount` figures by more than 2x (the round-up stopped being a
rounding and became the number), OR a production driver's provider reports spend in a currency outside ADR-1013's
INR + USD.

## Context

Engine Cycle 9 makes production drivers report what a run spent. Every figure the providers give is a **USD decimal**:
the `claude` CLI's result envelope carries `total_cost_usd` (a float, e.g. `0.0731`), and an OpenRouter-shaped
endpoint returns `usage.cost` in credits denominated in USD (e.g. `0.000183`). The spine's money rule is ADR-1012
(LED-M): every monetary field is an integer count of **minor units** of the event's `currency`, and a non-integer is a
strict-mode rejection. `cost.incurred` is validated to that rule (`validate-ledger.mjs` `assertCostIncurred`), and
the Money room (`costs.mjs`) renders per currency, never converting, because `cost.incurred` carries no `fx` block and
ADR-1003 forbids looking a rate up.

A per-call model cost is routinely **below one cent**. ADR-1012's own revisit trigger names this exact case ("a
provider reports an amount that cannot be expressed as an integer count of minor units without loss"), so the
representation has to be chosen here, before the first figure lands on an append-only log.

## Options considered

1. **USD cents, rounded UP at the minor unit; the exact provider figure kept beside it as a decimal string.**
   Integer arithmetic and ADR-1012 hold; a cap compares integers; any non-zero spend is at least 1 cent, so the
   rounding errs toward over-stating, which is the safe side for a cap. Cost: a run of sub-cent calls over-states.
2. **USD cents, rounded half-up.** Matches ADR-1012's FX rounding rule; a `$0.0003` call becomes `0`, a *measured
   zero* — the absent-becomes-zero failure this lane refuses, wearing a measurement's clothes.
3. **Convert to INR paise at a pinned rate.** Paise are 1/100 of a rupee (~USD 0.00012), finer than cents; but the
   rate is a receipt (ADR-1003) nobody has, so every figure becomes an estimate — ADR-0069 b5 forbids it.
4. **A sub-minor unit (`USD` micro-dollars) under a `scale` field.** Lossless, and every existing reader
   (`costs.mjs`, `pnl.mjs`, `org/lib/attribution.mjs`, `policy/spend.mjs`) would read micro-dollars as cents and
   inflate spend 10,000x until each learned the field. A cross-lane schema change, out of this cycle's appetite.

## Decision

Option 1. A driver's reported spend is `{ amount, currency, provider_amount }`:

- `currency` is the provider's own (`USD` for both production providers today). **No conversion, ever.**
- `amount` is an integer count of that currency's minor units, computed by **decimal-string arithmetic, never by
  float multiplication** (`0.07 * 100` is `7.000000000000001`, whose ceiling is 8): the provider's number is rendered
  by `String()` (shortest round-trip form, exponent forms included) and parsed as digits; the minor-unit part is the
  first two fractional digits, plus one if any later digit is non-zero.
- `provider_amount` is the provider's figure as a decimal string, unrounded, so the over-statement is measurable from
  the receipts alone (the revisit trigger reads it).
- A provider figure that is absent, `null`, negative, non-finite, a string, or past ADR-1012's 1e12 sanity bound is
  **no figure**: the spend is absent, never `0`. A provider that reports `0` (a free model) is a measured `0`.

The reason that carried the most weight: it is the only option under which a cap can be compared in exact integers
without either inventing a rate or turning a real, small spend into a recorded zero.

**On the `claude` CLI's figure.** `total_cost_usd` is the harness's own usage surface, reported by it, not estimated by
arc. On a subscription login it is the API-equivalent price rather than an invoiced amount; it is still recorded,
labelled `provider: claude-code`, and that difference is an assumption in the cycle PLAN with a trigger, not hidden.

## Consequences

- **Easier:** every money comparison in the engine is integer and order-independent; `cost.incurred` passes the
  ledger validator unchanged; the Money room renders USD with no new code path.
- **Harder:** sub-cent runs over-state, by design, toward the cap's safe side. The exact figure rides every receipt so
  the size of that over-statement is a query, not a guess.
- **Revisit:** see the trigger above. Moving to a sub-minor unit later is additive (a new field the readers learn),
  and the receipts already carry the exact figure that migration would need.
