# ADR 1416 — The EXP-A1 prediction is session-authored on the owner's delegation, and says so

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the owner writes his own prediction before Phase 04 runs — his text then
replaces this one verbatim and this ADR is superseded rather than amended.

## Context

[ADR-1411](1411-dsv-l-calibration-is-controlled-or-it-is-theatre.md) seals three predictions at
kickoff, the third being the owner's EXP-A1 call. That prediction exists to fix a **logged
deviation** in [ADR-0070](0070-composer-seat-stays-balanced-workhorse.md): its paired run had no
pre-registered prediction, so its outcome could not falsify anything anyone had committed to in
advance.

Asked for that call at kickoff, the owner declined to name an arm and gave a mandate instead:
*"enaku world best designer venum, avlo than goal — ethu venumo atha pannu."* — the goal is
world-best design output; do whatever is needed.

That is a delegation, not a prediction. Recording it *as* the owner's prediction would be a
fabrication, and an unfalsifiable one. Recording no prediction at all would reproduce ADR-0070's
deviation in the very experiment built to fix it.

## Options considered

1. **Record no prediction** — pros: honest about the gap / cons: reproduces the exact deviation
   EXP-A1 exists to close.
2. **Attribute a prediction to the owner** — pros: satisfies the form / cons: it would be a
   sentence he did not write, presented as his commitment. Not acceptable at any convenience.
3. **Session-authored prediction, sealed, with authorship stated on its face** — pros: keeps
   falsifiability and keeps authorship honest / cons: it calibrates the session, not the owner.

## Decision

Option 3. **Sealed prediction, authored by the kickoff session, 2026-08-23, before any Phase 04
work exists:**

> **Balanced-workhorse holds.** EXP-A1 will return **no material owner-visible gain** for the
> high-judgment arm, and the standing formula will therefore return **no promotion**.
>
> Reasoning: [ADR-0049](0049-constraints-caused-the-convergence-freedom-restored.md) measured
> that this loop's own **constraints**, not the model's capability, caused the convergence — the
> same model produced clearly better design with the pipeline switched off than with it on.
> Design v2 removes constraints and adds eyes, a pack and a craft-first jury. If regime dominates
> tier, then lifting the regime is what moves the output, and the tier gap stays below the
> owner-visible threshold. **Confidence: medium** — the honest counter is that a stronger model
> has more to do with the room once the room exists, and that case has never been measured.

Authorship is stated wherever this prediction appears. It calibrates the session's model of the
system, and that is what it will be scored as.

The owner may replace this text with his own at any point **before Phase 04 runs**. Replacing it
after the run has produced data would not be a prediction, and is refused.

## Consequences

Easier: EXP-A1 closes ADR-0070's deviation with a real pre-registered commitment, and Phase 08's
retro has something that can actually be scored wrong. Harder: a hit here calibrates the
session's judgment rather than the owner's, so the owner's own calibration on this question stays
unmeasured — which is a real gap, honestly labelled, not one this ADR can close on his behalf.
