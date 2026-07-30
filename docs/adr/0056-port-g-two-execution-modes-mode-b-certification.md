# ADR 0056 — PORT-G: two execution modes; Mode B certified only by REQ-04

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

Multiple lanes could mean concurrent sessions writing the shared spine. Concurrency
claims must be earned by fixtures, not asserted. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §5 PORT-G (round-5 certification ladder).

## Options considered

- Allow parallel sessions from day one — rejected: append atomicity across worktrees is
  unproven on Windows; REQ-04's zero-interleaving claim would be dishonest.
- Certification ladder — accepted.

## Decision

**Mode A (default): parked-lane switching** — one working tree, one session at a time; a
blocked lane parks cleanly (`## Now` carries `blocked-on:`) and another lane's session
proceeds. **Mode B: true parallel** via `git worktree` per lane, only when genuinely
needed. One session = one lane, always. Ladder: Phase 0–1 green → Mode A usable (the
core value). REQ-04 fixtures green → Mode B **certified**. Until then Mode B is
**UNSUPPORTED**: no concurrent emitters; the board carries a `Mode B: not certified`
note.

## Consequences

- The spool (REQ-04) is a reliability subsystem, not polish — parallel writes wait for
  its proof.
- If Phase 2 overruns, the pre-written cut is: ship Mode-A core value (P0–P1), defer
  REQ-04 + Mode-B certification to a follow-up slice (PLAN §Appetite scope-cut ladder).
- Real-world parallel validation is explicitly the NEXT cycle's job (develop kickoff =
  first native lane, counted lanes = 2).
