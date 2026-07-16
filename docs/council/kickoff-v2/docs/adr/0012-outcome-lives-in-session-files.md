# ADR 0012 — Calibration data lives inside session files; the table is computed, never stored

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** (optional) `council-calibrate.mjs` needs >5s to scan `docs/council/sessions/`, or a consumer needs calibration data without read access to sessions.

## Context
The calibration loop needs three data points per deep verdict: the pre-registered
prediction+confidence (already in the verdict), a Review-by date + resolution criterion (new at
save time), and the recorded OUTCOME (new at review time). They can live in the session file
itself or in a separate append-only ledger. Two-way door — a ledger can be generated from
sessions later — so auto-decided per kickoff protocol.

## Options considered
1. **In-session fields, script-computed table** — verdict template gains `Review-by:` + `Resolution:` lines; `/arc-council review` appends a `## OUTCOME` section; `council-calibrate.mjs` scans `sessions/` and renders the table on demand — pros: one source of truth, nothing to drift, works on any repo state; cons: scoring re-parses every session per run.
2. **Separate calibration ledger file** — pros: O(1) reads, one grep-able table; cons: second copy of per-session facts that WILL drift from the files it summarizes (the same failure mode kickoff-lint's nonneg-drift gate exists to catch elsewhere).

## Decision
Option 1: session files are the single source of truth; the calibration table is computed output,
never stored state. The carrying reason: a derived table cannot drift — and drift-proofing beats
read speed at the scale of a decision log (tens of files, not thousands).

## Consequences
Easier: `review` and `calibrate` stay stateless; append-only sessions remain the whole persistence
story; no new sync/exclusion rules. Harder: OUTCOME sections must be strictly parseable
(fixture-tested in Phase 1); scan cost grows with session count — the revisit trigger names the
threshold.
