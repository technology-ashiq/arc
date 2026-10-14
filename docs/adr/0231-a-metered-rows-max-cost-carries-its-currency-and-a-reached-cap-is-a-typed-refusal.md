# ADR 0231 — A metered row's `max_cost` carries its currency, and a reached cap is a typed refusal

**Status:** accepted
**Date:** 2026-10-14
**Product:** engine
**Reversibility:** two-way
**Revisit trigger:** a live row's cap refuses a hop the owner wanted taken (a `MAX_COST_REACHED` receipt he disputes),
or a chain mixes two currencies.

## Context

ADR-0228 item 6 made `max_cost` a required router term — integer paise, or `unmetered` — and refused a number on a
chain no driver meters. `METERING_DRIVERS` held only `mock`, so every live row was `unmetered` and the term bound
nothing. ADR-0229 makes `claude-code` and `generic-api` report spend **in USD**, and `max_cost` was written in paise:
comparing the two would need an FX rate the spine does not have (ADR-1003).

## Options considered

1. **`max_cost` stays an integer and a numeric value requires `max_cost_currency`** (ISO-4217, INR or USD per
   ADR-1013). Spend in another currency than the cap's leaves the total unproven, and an unproven total refuses.
2. **`max_cost` becomes an object `{amount, currency}`.** Same meaning, and every fixture writing `max_cost: N`
   breaks shape at once.
3. **An implied currency (INR when absent).** An absent value silently defaulted — the shape this lane refuses.

## Decision

Option 1, and:

- `claude-code` and `generic-api` join `METERING_DRIVERS` in the reviewed diff that makes them report spend. Every
  `engine/router.yaml` row whose chain holds one then carries a numeric `max_cost` and `max_cost_currency: USD`, each
  value with its reason beside it; `hermes` (its runtime reports only an estimate, refused by REQ-05) keeps its row
  `unmetered`.
- **Load faults:** a numeric `max_cost` with an absent, empty or non-ISO `max_cost_currency`; a `max_cost_currency` on
  an `unmetered` row; and, unchanged from ADR-0228, a numeric cap on a chain no driver meters ("a cap nothing can
  measure is a lie").
- **The cap bites:** before any further attempt (a fallback hop or ADR-0204's same-driver schema retry) the run's
  measured spend in the cap's currency is compared; at or past the cap the attempt is **refused before its driver
  starts**, and `run.completed` carries `failure_class: budget` plus a typed `refusal`:
  `{ code: "MAX_COST_REACHED", spent: {amount, currency}, cap: {amount, currency} }`, or
  `{ code: "MAX_COST_UNPROVEN", ... }` when an answered attempt reported no figure or a different currency (ADR-0228
  F3). No new event kind: the receipt is `run.completed`.
- The first attempt of a run is never refused by `max_cost` (nothing is spent yet); the caller's `--budget` bounds it.

## Consequences

- **Easier:** a live chain's money term is a real, testable bound, and the refusal names its reason in a field a
  reader can switch on.
- **Not a per-attempt ceiling:** the check runs between attempts, so one long attempt can overshoot the cap, and the
  receipt then records `spent` > `cap`. Passing the remaining cap into the `claude` CLI as a max-budget flag is a
  revisit, not this cycle.
- **Harder:** every fixture router with a numeric `max_cost` gains `max_cost_currency` in the same PR (counted when the
  phase starts). A chain where the CLI stops reporting `total_cost_usd` loses its fallback (unproven refuses), which is
  the safe direction and is receipted, not hidden.
