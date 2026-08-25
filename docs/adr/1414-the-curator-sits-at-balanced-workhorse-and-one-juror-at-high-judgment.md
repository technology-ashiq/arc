# ADR 1414 — The curator sits at balanced-workhorse; one juror moves to high-judgment

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** curator packs are found to be mechanically assembled — screens that match
the brief's nouns but carry no usable adaptable principle — in which case the seat is wrong in
the *other* direction and the work, not the tier, needs redefining.

## Context

Two new tier decisions fall out of design v2, and under
`docs/adr/0069-balanced-model-policy.md` a `model:` line is a governed production tier change
that ships as a reviewed diff citing that ADR — never a quiet edit. This ADR is that citation.

ADR-0069 defines the tiers by the **work**, not the vendor:
**cheap-scan** is *"mechanical enumeration and retrieval; reads a lot, decides nothing; a wrong
answer is visibly wrong and cheap to redo"*; **balanced-workhorse** is *"bounded, structured
production: research, drafting, critique against a given standard, tool-driving"*;
**high-judgment** *"grades other work, gates a decision, or makes a call that is expensive to
reverse — the seat where being under-powered is invisible until it is costly."*

## Options considered

1. **Curator at cheap-scan** — pros: cheapest, and pack assembly looks like retrieval / cons:
   the curator does not only retrieve; it writes the **adaptable principle** for each screen,
   and a wrong principle is *not* visibly wrong. It silently becomes the composer's input and
   the critic's BELOW-BAR anchor.
2. **Curator at balanced-workhorse** — pros: matches "critique against a given standard" / cons:
   costs more per pack.
3. **Curator at high-judgment** — pros: safest / cons: the curator does not gate a decision; the
   critic and jury do. Over-seating here would make the tier map meaningless.

## Decision

**Curator → balanced-workhorse.** The disqualifier for cheap-scan is ADR-0069's own test: a
wrong adaptable principle is not visibly wrong and not cheap to redo — it propagates into the
composer's brief and the critic's anchor before anyone can see it.

**One juror → high-judgment.** A juror *grades other work*, which is ADR-0069's definition of
that tier verbatim, so this is the tier map applied rather than bent. It also satisfies
[ADR-1405](1405-dsv-f-the-jury-ranks-craft-first-n-items-model-mixed.md)'s model-mix requirement
by construction, since the composer stays at balanced-workhorse under
[ADR-1400](1400-dsv-a-the-composer-seat-changes-only-through-exp-a1.md).

The composer's own seat is untouched by this ADR — it moves only through EXP-A1.

**Rejected because:** cheap-scan curator — a wrong principle is invisible, not cheap;
high-judgment curator — it does not gate a decision, and over-seating erodes the map.

## Consequences

Easier: both tier choices are derivable from ADR-0069's text, so neither is taste. Harder: one
juror's cost per explore rises, and the three-juror panel is no longer homogeneous — rankings
from different tiers may diverge, which is the point but does make the panel's disagreements
harder to read.
