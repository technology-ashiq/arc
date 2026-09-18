# ADR 1333 — the REQ set is reshaped so every REQ closes in one phase, and the session door earns a REQ

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a phase closes with a REQ whose earlier half (carried as a prior phase's exit criterion) was never proven → move that half back into the REQ by `/arc-change`.
**Provenance:** owner ruling at the Cycle 16 kickoff, 2026-09-16 (keep P06; REQ-08 becomes a non-negotiable). Mapping choices are two-way and recorded here.

## Context

PLAN-face-v2 §4 maps REQ-04 to P02 and P05 and REQ-09 to P03 and P05. `kickoff-lint` requires
exactly one phase per REQ and at least one REQ for every phase above 0. P06 (session door)
served none, and the tier-L cap of 10 was full. §13 item 6 (keep P06 or bank it) was open.

## Options considered

1. **Keep P06; move REQ-08 ("the stamp survives") to Non-negotiables + a P05 exit criterion; the freed REQ-08 slot measures the session door; REQ-04 and REQ-09 close in P05, the phase where both halves are finally true.**
2. **Bank P06 to the next cycle** — the owner declined.
3. **Map the split REQs to their EARLIER phase** — a REQ would read validated while half of it did not exist.

## Decision

Option 1. REQ-08's measurement is not lost: the byte-parity fixture was already a regression
bar ("not new work", PLAN-face-v2 §1), it is verbatim in Non-negotiables, and it is a P05 exit
criterion. The earlier halves — REQ-04's module↔registry check in P02, REQ-09's smoke in CI
from P00/P03 — are exit criteria of those phases.

## Consequences

- P05 carries REQ-04, REQ-07 and REQ-09; its close is the largest evidence bundle of the cycle.
- The new REQ-08 is measured by a click-started session that streams its phases and lands its verdict as a receipt of an existing kind.
