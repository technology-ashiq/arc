# ADR 1013 — LED-N: the one foreign currency in v1 is USD

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** the first real foreign settlement arrives in a currency other than USD — the
fixtures are then extended rather than replaced, because the mechanism is per-currency already.

## Context

REQ-04 scopes currency support to "INR plus one foreign currency" and never names which one. The
name is needed at kickoff because it selects the cross-currency fixtures and the second export
parser built inside Phase 0's three days.

The constraint is deliberate: multi-currency beyond INR plus one is a named rabbit hole.

## Options considered

1. **USD** — merchant-of-record providers overwhelmingly settle SaaS revenue in USD, and it is the
   most likely international price point for LexOS.
2. **EUR** — plausible for an EU-heavy customer base, which no evidence currently suggests.
3. **Leave it unnamed and make the code currency-generic in v1** — sounds free, and it is how a
   rabbit hole starts: generic currency handling needs a currency table, per-currency minor-unit
   rules and rounding conventions, none of which have a consumer yet.

## Decision

Option 1: **USD**. Cross-currency fixtures use INR plus USD, and the second export parser targets a
merchant-of-record settlement in USD.

The mechanism, however, is **not hardcoded to USD**. LED-M (ADR-1012) stores amounts as minor units
against the event's own `currency` field, and LED-D (ADR-1003) records the rate on the event, so a
third currency is new fixtures and a minor-unit entry — not a redesign. What v1 declines is the
*generic* path with no consumer, not the possibility of one.

The reason that carried the most weight: this is a fixture-selection decision wearing the costume of
an architecture decision, and its actual cost of reversal is one fixture set.

## Consequences

Easier: Phase 0's cross-currency fixtures are concrete and can be written on day one.

Harder: a first settlement in a third currency needs a small addition before it renders. The
assumptions ledger carries the trigger, and USD's minor unit (cents, 2 places) shares INR's shape,
so the arithmetic path is exercised by both.
