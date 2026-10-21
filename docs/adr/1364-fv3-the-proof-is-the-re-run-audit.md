# ADR 1364 — FV3-H: the proof is the re-run audit, and it becomes a CI gate in Phase 01

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-H), recorded at the Cycle 17 kickoff; its CI form is REQ-04 of this cycle
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** the measured first-verb position stops matching what the owner sees (a viewport change, a new header row)
**Bound by:** ADR-1336 (the browser harness) · ADR-1331 (both moods judged)

## Context

The faults were found by measuring, not by reading code; the same measure is the only honest exit.

## Options considered

1. **The audit that found the faults is the exit: page heights, first-verb position, every op planned with its placeholder, 0 console errors (chosen).**
2. **Screenshot review only** — not repeatable.

## Decision

Phase 00 closes on the #449 audit numbers and CI run 39551997252 (19/19). Phase 01 turns the first-verb check into a CI assertion (REQ-04).

## Consequences

- Until REQ-04 lands, a regression that pushes verbs down is invisible to CI.
