# ADR 1411 — DSV-L: calibration is controlled, or it is theatre

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the plain-prompt control beats the full loop twice running — the pipeline
is then net-negative again, which is precisely what
[ADR-0049](0049-constraints-caused-the-convergence-freedom-restored.md) measured once already.

## Context

The lane's central quality signal is the owner's judgment, and in Cycle 3 that signal was
collected uncontrolled: a number, after unblinding, with no rubric and no anchors. An
uncontrolled 0–100 score has variance that eats the signal it carries.

Worse, [ADR-0049](0049-constraints-caused-the-convergence-freedom-restored.md) established that
this loop was once **net-negative** — the same model produced better design with the pipeline
switched **off** than with it on. Nothing in the current design measures that continuously, so
the regression could recur invisibly.

## Options considered

1. **Ask the owner for a score after each explore** — pros: zero ceremony / cons: this is what
   produced an unusable number last cycle.
2. **A controlled ritual: seeded shuffle, rubric, anchors, blind before unblinding, plus a
   standing control item** — pros: the number becomes comparable across runs / cons: costs the
   owner a few minutes per explore and someone must maintain the anchors.

## Decision

Option 2. Per full explore: **seeded shuffle**, a short **rubric** with **anchor examples**, and
the owner scores **0–100 blind before unblinding** — receipted.

Every jury pack carries **≥1 non-arc item**: the reference screen always, rivals once Phase 07
lands, and a **plain-prompt control every 3rd run** so "we beat the plain prompt" stays
measurable forever rather than becoming folklore.

**Sealed at kickoff**, before any of it runs:
1. post-Phase-03 controlled blind score **≥60/100** on a lexos-class brief;
2. rival-beats-all-arc rate **≤50%** by cycle end;
3. the EXP-A1 prediction (see
   [ADR-1416](1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md)).

Falsified predictions are recorded plainly. A ledger of hits calibrates nothing — that is the
lineage of [ADR-0038](0038-des-f-prediction-based-learning-two-ledgers.md).

## Consequences

Easier: the lane gets a comparable quality number and a permanent answer to "is the pipeline
better than no pipeline". Harder: the owner is now in the loop on a schedule rather than on
demand, and the anchors are an artifact somebody must keep honest — an anchor set that drifts
upward turns the whole scale into self-congratulation.
