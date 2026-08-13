# ADR 1003 — LED-D: FX conversion facts are recorded at ingest, never looked up at render

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a provider settles in a currency without giving a settlement rate, so no rate
exists at ingest time — then the rate becomes an explicitly-labelled operator input on the event,
still recorded at ingest, never a render-time lookup.

## Context

A P&L with a foreign-currency row has to convert. The obvious implementation fetches a rate when
rendering. That single choice breaks three properties at once: replay stops being deterministic
(the rate moves), replay stops being offline, and last month's closed P&L silently restates every
time it is rendered.

A conversion is not a calculation, it is a **fact about a moment**. Facts belong on the receipt.

## Options considered

1. **Rate recorded inside the event at ingest** — `rate`, `source`, `date` travel with the amount;
   render and replay perform zero lookups.
2. **Rate table in the repo, joined at render** — offline and deterministic, but a table edit
   retroactively rewrites every historical row, which is restatement with extra steps.
3. **Live FX API at render** — always current, never reproducible; fails the twin-determinism gate
   on the first run and fails replay entirely when offline.

## Decision

Option 1. Every foreign-currency event carries `fx: { rate, source, date }` recorded at ingest.
Render and replay perform **zero external lookups, ever** — a fixture proves a fully offline
replay is byte-identical. Foreign rows display the original currency beside INR, so the reader
sees what was actually charged as well as what it became.

The reason that carried the most weight: LED-E freezes closed months, and a render-time rate would
make a frozen month restate itself while claiming to be frozen — the two decisions are only
compatible in this shape.

## Consequences

Easier: replay is offline by construction, and every converted number can be audited back to the
rate that produced it and the source that supplied it.

Harder: ingest must always find a rate. Where a provider gives a settlement rate that is the
source (`provider-settlement`); where it does not, the operator supplies one and the `source`
field says so, honestly. An absent rate is a rejected ingest, not a guessed conversion — this
inherits MP-F's rule that recorded, estimated and fabricated are three different things and only
the first is allowed.

FX handling is parser-class and gets the mandatory adversarial pass before FAIL promotion.
