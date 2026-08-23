# ADR 1310 — FACE-K: three data modes — live · replay · sim — always visible in the chrome

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** dogfood week shows mode confusion (a sim value read as real, or the
mode indicator unnoticed) → the sim mode moves behind a flag or out of the build entirely.

## Context

The face needs demo data before the spine has fired every kind (only 14 of 46 ever
fired), and the tape needs a replay path. E3 forbids ever mixing real with simulated.

## Options considered

1. **Three explicit modes with a permanent chrome indicator** — `live` (L2 real) ·
   `replay` (as-of) · `sim` (seeded day generator, every value watermarked SIMULATED).
   Pros: demos and fixtures without lying; the honesty-classes fixture applies to the
   mode itself. Cons: three code paths to keep honest.
2. **Sim data mixed in where live data is absent** — cons: violates E3 outright.

## Decision

Option 1. The mode is always visible in the chrome; `sim` watermarks every value
(ADR-1313's hatched violet family); `replay` is ADR-1305's as-of; the L2 server serves
sim and replay as **labelled** modes. Honest-empty is the correct live rendering for a
kind that has never fired — sim never fills a live view.

## Consequences

Easier: Phase 04's shell can demo against sim on day one; fixtures get a deterministic
seeded spine. Harder: every panel is built against all three modes plus the empty state —
the state matrix in the brief makes that mandatory anyway.
