# ADR 1343 — The company ring: a lane's status is a header edit, a word is a contract edit

**Status:** accepted
**Date:** 2026-09-20
**Product:** face (with two additive core scripts, under ADR-1339 and ADR-1340; the pattern is ADR-1342's)
**Reversibility:** two-way
**Revisit trigger:** the spine lane admits a lane-status kind (ADR-0026) -- the header would then be derived from
receipts instead of edited.

## Context

The company ring had two verb-pending cards: "Set a lane's status" (org) and "Define a term" (concepts). Neither has a
spine kind, and both change law files: a lane's status is its PROGRESS machine header, and PORTFOLIO.md's row is a view
that board-lint holds to it; a term is a row in the face's frozen contract, which face-coverage validates and the palette
searches.

## Decision

1. **A lane's status is a proposal branch** (`core/lane-status.mjs`): the lane's PROGRESS header (`status:` and
   `blocked-on:`) and its board row (the status cell and column 6) change in ONE commit, computed from main's bytes, so
   board-lint and the board suite stay green when it merges. Only a lane main holds can be set -- /arc-kickoff alone
   births a lane. A blocker is its own fact in ADR-0051's `<target> — <reason>`: BLOCKED needs one, any status may set
   one, `—` clears it, and none given keeps main's (a LIVE lane may carry one). The header must be one both its readers
   -- board-lint and the CI gate -- read alike, or the edit is refused. One open proposal of a lane's status at a time,
   per lane.
2. **A word is a proposal branch** (`core/concept-define.mjs`): the contract's concepts.map with the term homed in a
   BUILT room at a station, plus what the contract derives (face-sections), so face-coverage stays green. A word is
   defined once, whatever its case; a planned room is refused (a term there is unhomed). One open definition at a time.
3. **Both raise approval.requested** (gates `lane-status` and `concept-define`) for the owner's inbox, idem welded to the
   change and main's commit. Both are human-run effect ops: the owner ticks before a branch is written, and the merge is
   theirs.

## Consequences

- The org room keeps one card, "Birth a lane" (it stays /arc-kickoff's ceremony); the concepts room has none.
- A board row whose free "next" prose later holds something the face's scrub rewrites would hide that lane's status plan
  (PLAN_HIDDEN) -- a refusal, never a leak.

## Amendment, PR 5b round 1 (same day)

A fresh pair found 2 HIGH and 12 more. The decisions that moved: a blocker is kept unless the owner changes it (the
first cut wiped the blockers growth and scheduler carry while LIVE); every published value -- the blocker, the term,
the why -- is allow-listed, never only scrubbed; "one open proposal" is judged per lane by what a branch changed and
main does not hold yet, under a lock; and a header the two readers would read differently is refused rather than edited.
