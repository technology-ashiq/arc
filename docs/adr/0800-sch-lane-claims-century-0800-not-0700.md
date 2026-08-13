# ADR 0800 — scheduler claims century 0800–0899, not the 0700s the board offered

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** one-way
**Revisit trigger:** ADR-0899 is written — the band is 80% consumed and the next scheduler cycle needs a second century allocated before it numbers anything.

## Context

`PLAN-scheduler.md` §13.4 left the century open and instructed kickoff to claim "the next free
century per `PORTFOLIO.md` (0600s as of 2026-08-08)". Two things were wrong with that
instruction by the time it was executed, and the second is the dangerous one.

First, the 0600s were gone: `absorb` claimed 0600–0699 at birth on 2026-08-09 and the board
records it. The board's own table therefore offers `0700–0799 | next lane to be born`.

Second — and this is why the ADR exists — **the 0700s are already spent.** The `memory` lane
(Cycle 11, opened 2026-08-11, `status: LIVE`, phase 02, burn 2.75/5d) has written
`docs/adr/0700-*` through `0709-*` on branch `technology-ashiq/arc-memory`. None of it is
merged, so `origin/main`'s `PORTFOLIO.md` still advertises 0700–0799 as free and carries no
board row for `memory` at all.

This is the 2026-08-02 model-policy/develop collision reproducing exactly, for the third time,
with one new twist: the previous two were caught by a human mentioning the other session. Here
the losing branch would have been discovered by `kickoff-lint [adr-dup]` — but only *after* a
merge, and only on whichever branch merged second. Renumbering is cheap while the loser lives
on one branch and expensive after it merges; this ADR spends that cheapness now.

## Options considered

1. **Claim 0700–0799 as the board says** — pros: follows the written instruction literally.
   Cons: seven files land in head-on collision with a LIVE lane's ten; every citation in both
   lanes becomes ambiguous at merge.
2. **Claim 0800–0899** — pros: collision-free against every band in use, merged or not; leaves
   memory's unmerged claim intact so that lane never renumbers. Cons: `PORTFOLIO.md` is now
   wrong in two rows rather than one until both lanes merge.
3. **Wait for memory to merge, then re-read the board** — pros: the board becomes true first.
   Cons: blocks this kickoff on another lane's merge schedule for a purely clerical fact.

## Decision

**scheduler claims 0800–0899.** ADRs 0800–0806 are this kickoff's.

The one reason that carried the most weight: the band table is a *prevention* mechanism and the
lint is only the *control*. Reading the band from a file that cannot see unmerged branches is
precisely the failure mode the band was introduced to stop, so the honest read of "next free
century" is the next century free **across every live lane's working tree**, not the next one
the merged board happens to advertise.

**Evidence:** `C:/Users/ashiq/orca/workspaces/arc/arc-memory/docs/adr/` contains ten files
matching `^07` (0700-mem-a … 0709-mem-k); `initiatives/memory/PROGRESS.md` on that branch reads
`status: LIVE`, `cycle: arc-memory (Cycle 11, opened 2026-08-11)`, `phase: 02`.
`git show origin/main:PORTFOLIO.md` line 47 reads `| 0700–0799 | next lane to be born |` and the
board has no `memory` row. Checked 2026-08-12.
**Confidence:** high
**Rejected because:** option 1 — creates the exact ambiguity the band exists to prevent;
option 3 — blocks a kickoff on another lane's merge for a clerical fact.

## Consequences

**Easier.** Both lanes keep every number they have already written. Nothing renumbers.

**Harder — the honest half.** `PORTFOLIO.md`'s band table is now stale in two rows (0700s =
`memory`, 0800s = `scheduler`) and its board is missing a LIVE lane. That file is a shared
company organ (ADR-0053) which two live lanes are already editing, so per
`.claude/rules/lanes.md` this kickoff does **not** silently rewrite it: the correction is
listed as an owner-visible item in the STOP output, to land in one place rather than as a
third parallel edit to a file that already has two.

**What we would revisit if this goes wrong.** If a fourth lane is born while two bands sit
unmerged, reading working trees stops scaling and the band allocation needs to move to a
mechanism that does not depend on what any one checkout can see.
