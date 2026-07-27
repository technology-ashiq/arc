# ADR 0041 — all four phases in this cycle; blind-test evidence may trail the build

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** one-way
**Revisit trigger:** no Stream A or Stream B evidence within 14 days of Phase-3 build-complete → the follow-on decision (extend collection, change recruiting channel, or park REQ-01) is forced back to the owner.

## Context

Owner fork at kickoff (2026-07-28). The external blind test (ADR-0040) needs elapsed
calendar time — recruiting designers + users at ₹0 — which arc cannot control inside a
5-day build appetite. Owner's call: *"do it all; finally test in LexOS; goal = world-best
designer."*

## Options considered

1. **All 4 phases in-cycle, evidence trails** — the 5 build-days cover Phases 0–3 work including launching the blind test; Stream A/B evidence arrives when it arrives. Con: the cycle can close with REQ-01 still `active`.
2. **Phases 0–2 only, Phase 3 its own cycle** — clean close. Con: the loop ships without ever touching a real product; kicked the goal down the road.
3. **Weaken REQ-01 to one stream** — fits the window. Con: re-litigates locked DES-H; rejected outright.

## Decision

Option 1 (owner's explicit call). Phase 3 closes on build-complete + blind test
*launched*; REQ-01 flips to `validated` only when both streams pass (Cycle-2 precedent:
"mechanism proven, live value pending" — REQ-07). The phase-done call at Phase 3 is the
owner's.

## Consequences

Easier: the whole loop, including the LexOS pilot, exists inside one cycle. Harder:
cycle close and REQ-01 validation decouple — PROGRESS.md must show that honestly.
