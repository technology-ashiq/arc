# ADR 0009 — Calibration scoring uses categorical confidence buckets, not a new numeric line

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** one-way
**Revisit trigger:** once ≥10 outcomes are recorded, if bucketed Brier scores are too coarse to distinguish High-vs-Medium calibration (score difference smaller than the bucket width can explain), add the numeric `CONFIDENCE-PROB:` line as the recorded upgrade path.

## Context
The calibration loop needs a probability per verdict to compute Brier scores against recorded
outcomes. The shipped verdict contract carries `CONFIDENCE: High | Medium | Low` — categorical.
Adding a numeric probability line means changing the already-shipped, lint-enforced verdict
contract for every future session; not adding one means coarser scoring. The choice shapes every
saved session from v2 onward, so it is a one-way door despite the upgrade path.

## Options considered
1. **Categorical buckets** — map High=0.85, Med=0.65, Low=0.5 inside the scoring script — pros: zero change to the shipped contract, lint regex, or Chair template; numeric can layer on later; cons: coarse (three probability values), bucket constants are priors until real outcomes exist.
2. **New required `CONFIDENCE-PROB: 0.NN` line** — pros: true per-verdict Brier precision from day one; cons: schema change to a shipped non-negotiable contract, new lint check, all members/Chair templates touched, and false precision — the council has zero outcome data to justify two-decimal probabilities yet.

## Decision
Option 1. The scoring script (`council-calibrate.mjs`) owns the bucket mapping
(High=0.85 · Med=0.65 · Low=0.5); the verdict contract is untouched. The carrying reason:
calibration must start collecting outcomes NOW with zero contract churn — precision without
outcome data is decoration, and the numeric line remains a strict, recorded upgrade path.

## Consequences
Easier: v2 ships calibration without touching the verdict contract or old sessions; the bucket
constants live in ONE script. Harder: early Brier numbers are coarse and the constants are
asserted priors — the assumptions ledger carries a falsification trigger (High-confidence verdicts
proving <60% accurate forces an ADR revisit). Revisit path: add `CONFIDENCE-PROB:` (optional line,
lint-accepted) once the trigger or ≥10 outcomes justify it.
