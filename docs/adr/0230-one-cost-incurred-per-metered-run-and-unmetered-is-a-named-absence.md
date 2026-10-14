# ADR 0230 — One `cost.incurred` per metered run, and unmetered is a named absence

**Status:** accepted
**Date:** 2026-10-14
**Product:** engine
**Reversibility:** two-way
**Revisit trigger:** a reader needs per-ATTEMPT money rows (one `cost.incurred` per hop) that the run total plus
`hops[].spend` on `run.completed` cannot answer.

## Context

ADR-1001 (LED-B) puts money data only on the spine, as `cost.incurred` (a company kind, no new kind needed). Until now
no production run wrote one: the drivers measured tokens and never spend (ADR-0228's "every live row is unmetered").
With ADR-0229 a driver can report spend, so arc-run has to decide **who writes the money receipt, how many, and what
a run with no figure leaves behind**. Three readers already fold `cost.incurred`: `hq/lib/ledger/costs.mjs` and
`pnl.mjs` (the Money room), `org/lib/attribution.mjs` (by `process`/`role`), and `hq/lib/policy/spend.mjs`, which
treats a `cost.incurred` carrying `reservation_ref` as the settlement half of a spend reservation.

## Options considered

1. **arc-run writes one `cost.incurred` per run, after `run.completed`, through `emitEvent`**, carrying the sum of
   the run's measured attempts. One money row per run; the hop detail stays on `run.completed`.
2. **The driver writes its own `cost.incurred`.** Five drivers, five emit paths, and a driver killed mid-run would
   leave the money and the run receipt disagreeing — the "validate one read, compare another" twin this lane records.
3. **One `cost.incurred` per attempt.** Exact per hop, and triples the money rows of a fallback chain for a figure
   `run.completed.hops[]` already carries.

## Decision

Option 1. The rules:

- **Who:** arc-run alone, through its one emit path (`emitEvent` → `arc-event.sh emit`), after `run.completed`, so
  every money row has its run receipt. The emit is VERIFIED to have landed in `events/`, not `_quarantine/`.
- **How many:** exactly one per **metered** run — a run where at least one attempt reported a figure. The amount is
  the ceiling of the EXACT decimal-string sum of the run's measured attempts' `provider_amount` in one currency — ONE
  rounding per run per currency, never a sum of per-attempt ceilings (`ceil(a)+ceil(b) != ceil(a+b)`); the cap
  (`termsCheck`) reads the same sum through the same `common.mjs` function. Attempts in two currencies are never added: the
  run emits one `cost.incurred` per currency (no production chain mixes currencies today).
- **Payload:** `amount`, `currency`, `provider_amount` (the attempts' exact figures summed as decimal strings),
  `source: "measured"`, `venture: "arc"` (overhead, never a product venture), `process`, `driver`(s), `model`,
  `label`, and `run_ref` — the id `run.completed` was written under. **No `reservation_ref`**: this is not the
  settlement half of a policy reservation, and `spend.mjs` must not fold it as one (a fixture proves it).
- **Unmetered is a named absence, never a 0.** A run where no attempt reported a figure writes **no**
  `cost.incurred`, and its `run.completed` carries `spend: null` with `spend_absence` naming why:
  `driver-unmetered` (no attempt’s driver reads a provider figure) or `not-reported` (a driver that reads one
  looked and the provider gave none — the driver writes an explicit `spend: null` to say so, so the distinction is
  the driver’s observation, not a table lookup). A measured `0` is a real `cost.incurred` with `amount: 0`.
- **Double-count guard:** the emit's idempotency key is derived from `run_ref` + `currency`, so a second currency row for
  one run is not a duplicate, and re-emitting the same (run_ref, currency) is refused (`DUP_IDEM`). `run_ref` is unique
  per run, so two consecutive runs with an identical figure, process and model BOTH land (fixture: count 2, quarantine 0).
- **Whose figure:** `basis` is `harness-reported` (`claude-code`: on a subscription login a notional list price) or
  `provider-reported` (`generic-api`), and the `label` carries it so the Money room line says so.
- **Reverse trace:** `unbookedRuns(events)` lists every `run.completed` with non-null `spend` and no `cost.incurred` by
  `run_ref`; the crash window below is a count, not a silent gap, and Phase 14 requires it to be 0 on the live spine.

## Consequences

- **Easier:** the Money room shows engine spend with no change to its readers; the ledger sums one row per run.
- **Harder:** a run killed between `run.completed` and the money emit leaves a run receipt with a spend and no money
  row. That is detectable (a `run.completed` with `spend` and no `cost.incurred` by `run_ref`) and is a check in the
  cycle's close, not silently tolerated.
