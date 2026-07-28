# ADR 0038 — DES-F: learning is prediction-based; preference ledger and quality ledger stay distinct

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** three recorded predictions in a row that are unfalsifiable in practice (no outcome evidence could ever arrive) — the prediction format needs redesign.

## Context

"The system improved" needs evidence beyond artifact count. The council's Brier-ledger
proved the pattern: record a falsifiable claim at decision time, attach outcomes later.

## Options considered

1. **Prediction-based** — every owner pick records rationale + a falsifiable prediction ("We expect <direction> to <measurable effect> because <mechanism>"); post-release outcome evidence (user feedback, completion, friction) attaches to it via `note.logged`. Pick-rationales calibrate *preference*; predictions + outcomes + external streams calibrate *quality*. Two ledgers, never merged. Con: discipline required at every pick.
2. **Score trendlines** — easy to chart. Con: agents optimizing a number converge to safe-average (superseded row 2 killed absolute scores).
3. **No learning loop** — cheapest. Con: taste never compounds; the whole point lost.

## Decision

Option 1. A peer's "looks good" never counts as user validation; a user completing a task
never counts as craft evaluation — the two ledgers keep those apart.

## Consequences

Easier: "is the designer improving?" has an answerable form. Harder: every pick costs a
prediction; outcome evidence collection is unglamorous work that must actually happen
(Phase-3 launches it; ADR-0041 governs the trailing window).
