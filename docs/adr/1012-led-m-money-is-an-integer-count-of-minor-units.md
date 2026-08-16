# ADR 1012 — LED-M: money is an integer count of minor units, and rates are decimal strings

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a currency enters scope whose minor unit is not a fixed power of ten, or a
provider reports an amount that cannot be expressed as an integer count of minor units without loss.

## Context

The design source's Appendix A is marked *"normative sketch; final at kickoff"* and shows
`"amount": 1000` with `"gross": 1180, "tax": 180` — figures that read as whole rupees, and a
`"rate": 83.20` that is unambiguously fractional. The representation was never pinned. It has to be
pinned **before** Phase 0, because it is baked into the payload contract, the validator, and every
fixture, and because payloads on an append-only spine cannot be reformatted afterwards.

IEEE-754 doubles cannot represent most decimal fractions. `0.1 + 0.2` is the canonical example, and
the consequences here are worse than a wrong cent: this module must be **byte-reproducible on
replay** and must produce **byte-identical output across two reader engines**. A sum whose result
depends on accumulation order is not byte-reproducible.

Retro 2026-08-04 (arc-evolve) records the adjacent failure directly: a non-total encoder in a hash
preimage, where `JSON.stringify` folded `NaN` and `-Infinity` to `null` and gave two opposite gate
states one hash. Float money feeds exactly that kind of encoder.

## Options considered

1. **Integer minor units** (paise for INR, cents for USD) for every monetary field; arithmetic is
   integer arithmetic; formatting to a human string happens only at render.
2. **Float major units** — matches the sketch's readability and inherits every binary-floating-point
   defect, silently, in the one module whose entire value is being trustworthy.
3. **Decimal strings for amounts** — exact, and every arithmetic operation then needs a decimal
   library, which the zero-dependency constraint forbids and which would have to be hand-written.

## Decision

Option 1. **Every monetary field — `amount`, `gross`, `fees`, `tax`, `net` — is an integer count of
minor units** in the currency named by the same event's `currency` field. `1000` means ten rupees,
not one thousand. Appendix A's illustrative figures are restated in paise accordingly.

A non-integer monetary value is a **strict-mode rejection**, not a rounded acceptance.

**FX rates are not money and are not integers.** A rate is stored as a **decimal string**
(`"83.20"`), never a float, and conversion is performed as integer arithmetic over the scaled rate
with a pinned rounding rule (half-up, at the minor unit of the target currency). The rounding rule
is a fixture, so a converted total cannot drift with an implementation detail.

Razorpay's own API is already paise-denominated, so for the primary rail this is zero ingest-time
conversion rather than an imposition.

The reason that carried the most weight: this is the only representation under which "byte-identical
across engines and across replay" is a property of the design rather than a hope about accumulation
order.

## Consequences

Easier: all money arithmetic is exact and order-independent. Equality, summation and comparison are
integer operations, so fixtures are stable and a rounding disagreement becomes impossible rather
than rare.

Harder: every human-facing surface must format, and every human-facing input must parse. A typed
`45000` is ambiguous to a person, so the CLI takes and echoes a formatted amount and stores the
integer — and the normalizer, being parser-class, gets the adversarial pass before FAIL promotion.

The payload normalizer's rejection corpus must include the shapes that look like money and are not:
`"1000.00"` as a string, `1000.0` as a float, exponent notation, negative zero, and values beyond
safe-integer range.
