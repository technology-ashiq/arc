# ADR 1329 — FV2-L: Cycle 15 closes before this opens; REQ-10 is carried, not force-closed; the bar is TWO days

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a later cycle asks whether the HABIT holds (not whether the surface is operable) → that cycle may raise the bar; this ADR never claims the habit.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-L — adjudicated 2026-09-15, bar set by the owner 2026-09-16, LOCKED at the Cycle 16 kickoff. Cycle 15 closed 2026-09-16 (PR #231).

## Context

Cycle 15's REQ-10 ("every decision goes through the face", 5 days) reached 1 of 5 days —
`face-dogfood`: 6 decisions through the face, 54 outside. Face v2 replaces that surface.

## Options considered

1. **Close Cycle 15 with REQ-10 NOT MET and carried; this cycle's Phase 07 measures it on the final surface over 2 real days.**
2. **Force-close REQ-10 to tidy the board** — rejected in PLAN-face-v2 §10.
3. **Keep the 5-day bar** — the owner declined: the money chain is blocked on calendar-gated work, and three extra dogfood days buy a weaker thing than they cost.

## Decision

Option 1, with a two-day bar. Two days prove the surface is operable for real work (every
decision through the face and ≥1 op/day run from it); they do NOT prove the habit holds, and
REQ-10 claims exactly that and no more.

## Consequences

- Phase 07 cannot start before Phase 05 is green (≥1 op/day needs the work door).
- The retro lesson of 2026-09-16 (a usage requirement placed last reached 1 of 5 days) is answered by a usage TREND read from the first merged batch onward — reported, never counted toward the two days.
