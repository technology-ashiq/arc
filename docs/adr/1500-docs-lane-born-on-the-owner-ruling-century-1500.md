# ADR 1500 — The `docs` lane is born on the owner's 2026-09-18 ruling; century 1500–1599

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** the ruling cannot be put on the canonical spine as a `decision.recorded` before Phase 00 closes → every ADR in this band that cites it is re-read as resting on an unreceipted premise, and the phase does not close.

## Context

Design source `docs/strategy/plans/PLAN-docs.md` (landed 2026-09-19, owner-instructed) records an
owner ruling of **2026-09-18**: a wiki over every product, lane and feature where nothing is
missing, and where anything newly born appears without anyone remembering to add it. Decisions
DOC-A…K are locked there; DOC-L was left open for kickoff (ADR-1512).

**The ruling is not on the spine.** A search of `.claude/state/hq/events/2026-09-1*.jsonl` on the
canonical clone (`E:/Work_Hub/01_Automemory/arc`) found no `decision.recorded` naming it. The
design source already says so: putting it there is Phase 00's first act.

**Century claim.** `PORTFOLIO.md` on `main` says **1400–1499 is "next lane to be born"**. That is
stale: a sweep of all **37** worktrees on this machine plus every local and remote branch found
`feat/arc-design-v2-c16` (worktree `arc-design-2`, open PR #222) already holding **1400–1418**.
Nothing anywhere holds an ADR ≥ 1500. This is the **fifth** occurrence of the stale-band-row
pattern the board's own band table records (ledger, legal, growth, face, now docs): a band claimed
on an unmerged branch is invisible to a table that only sees `main`.

## Options considered

1. **Claim 1400 as the board says** — collides with design v2's eighteen unmerged ADRs; `[adr-dup]` goes red the day either branch merges second.
2. **Claim 1500 after the sweep** — free on every worktree, branch and remote ref checked.

## Decision

`docs` claims **1500–1599**. The band row lands in `PORTFOLIO.md` in the same change as the first
ADR, and the 1400 row is corrected to name `design` as its holder (on the unmerged branch), because
leaving "next lane to be born" on a band that is taken is the defect that caused this sweep.

## Consequences

- Every ADR in this lane cites the ruling by its `decision.recorded` event id once Phase 00 lands
  it; until then they cite the design source and this ADR.
- Birthing `initiatives/docs/` and the first `15xx` ADR makes `face-coverage` FAIL unless
  `initiatives/face/contracts/expected-set.json` gains `lanes.docs` and `adrs.1500` in the same
  change (its birth rule). That is a face-lane file: see ADR-1501.
