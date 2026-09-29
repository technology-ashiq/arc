# ADR 1612 — ORG-L: the pilot venture is Nilluvai, registered through `venture-register` before Phase 02, or the cycle pauses after Phase 01

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** Nilluvai is not in `ventures.yaml` with an approved `ledger.criteria` receipt when Phase 01 closes -> the cycle pauses; no substitute pilot.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-L). Verified at kickoff: **Nilluvai is not registered** — `ventures.yaml` holds only `lexos` (paused, outside arc). `venture-register.mjs:73` refuses `--slug arc` ("the factory's overhead, never a venture"). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Nilluvai** — the owner's chosen next venture.
2. **arc as pilot** — refused by the code.
3. **LexOS** — paused and outside arc.

## Decision
Nilluvai, registered by the owner through `venture-register` + its approval (kill lines and passport are his). Phases 00–01 do not need it and bank a complete catalog and a working scorecard over arc's own lanes either way.

## Consequences
Easier: REQ-08 is measured on a real venture. Harder: the cycle's second half depends on an owner action outside code.
