# ADR 0017 — Juror scope: the ADR-0014 charter only (rebuttal set + first-pass anchors)

**Status:** accepted
**Date:** 2026-07-16
**Reversibility:** one-way
**Revisit trigger:** ≥3 real deep runs where a Weak/misgraded point OUTSIDE the rebuttal set materially
shaped the decision (the minimal scope provably missed something a full second pass would have caught).

## Context
The juror could re-grade everything (a full parallel verifier) or only the fabrication surface ADR-0014
names: the rebuttal-set points and the persisted `## FIRST-PASS RATINGS` they anchor to. Full-parallel
doubles grading cost/latency and needs disagreement-resolution machinery across every POINT-ID — it is a
second verifier, not a juror — and does not fit a 3-day S-tier appetite.

## Options considered
1. **ADR-0014 charter scope** — the juror independently grades ONLY the rebuttal-set IDs and their
   first-pass/final ratings — pros: directly closes the named revisit trigger, cheap (one call), fits the
   appetite, widenable later by ADR; cons: non-rebuttal points get no cross-model check in v3.
2. **Full parallel verifier** — pros: full coverage; cons: ~2× grading cost, a disagreement-resolution
   design problem for every ID, blows the S-tier budget.

## Decision
Option 1 (user-selected). The juror receives the rebuttal-set points (verbatim member text + the
verifier's first-pass and final ratings + the rebuttals) and independently rates each rebuttal-set ID.
The carrying reason: v3's job is to close ADR-0014's residual, not to rebuild the verifier — scope
matches charter.

## Consequences
Easier: one bounded juror call per deep run; the output contract stays small and parseable. Harder: the
juror adds no coverage on non-rebuttal points (accepted; the revisit trigger names the evidence that
would widen it).
