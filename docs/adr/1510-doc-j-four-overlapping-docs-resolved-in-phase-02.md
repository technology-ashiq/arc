# ADR 1510 — DOC-J: the four overlapping documents are resolved inside the cycle, in Phase 02

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way

## Context

Locked (DOC-J). Four documents already try to be this reference: `docs/how-it-works.md`,
`docs/how-arc-works-simple.md`, `docs/usermanual.md`, `docs/blueprint.md`. Shipping a wiki beside
them recreates the three-artifact identity crisis `BRIEF-dashboard` recorded. `CLAUDE.md` links
`docs/how-it-works.md` by name, so the move has at least one inbound reference to rewrite.

## Options considered

1. **Move all four to `docs/archive/` and rewrite every inbound link** — 68 referring files
   (20 + 7 + 20 + 21) against a 1-day phase; any link missed is a silent orphan, the exact failure
   this lane exists to prevent.
2. **Copy each original to `docs/archive/` and reduce the file at its original path to a stub of at
   most ten lines pointing into `docs/wiki/`** — zero inbound links break, nothing is deleted, and no
   referring file needs an edit. (Raised by the kickoff question-planner; decided here as a
   two-way door rather than asked.)

## Decision

Option 2. Phase 02 does not close until each of the four is a ≤ 10-line stub at its original path
naming its `docs/wiki/` replacement and its `docs/archive/` full copy (never deleted, A10), and the
strategy file map records it **in the same commit**. The `git grep -n` inbound-reference list for
each filename is in the phase-02 evidence bundle, so the links a later cleanup could retarget are
known. None of the four changes before the wiki that replaces it exists.

## Consequences

Content in the four that the generated wiki cannot carry (tutorial prose) is not lost: archived
copies stay readable, and anything worth keeping becomes a hand-written narrative later, under
ADR-1508.
