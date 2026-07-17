# ADR 0017 — Park the v2 "world-best" initiative to run the orchestrator restructure

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** two-way
**Revisit trigger:** the orchestrator initiative closes (any phase ≥0 banked) or is killed —
either way the v2 tracker un-parks and Phase 04 (QA pipeline) resumes as next up.

## Context

The v2 "world-best" initiative (archived tracker: docs/archive/PLAN-2026-07-17.md) was at
~13% appetite burnt (10-week cap, started ~2026-07-08), Phases 00–03 closed well under
appetite, Phase 04 (QA pipeline) not started, kill tripwire (50%) far away. The orchestrator
restructure (ADR-0014) is initiative-scale — 6 weeks, 6 phases — and cannot honestly live as
one phase row inside v2's plan. Running both in parallel is a solo-dev fiction.

## Options considered

1. **Finish v2 first** (4 more phases, ~8 weeks) — pros: no context switch; cons: every week
   of v2 work deepens the monolith the restructure must then move (more scripts, more gates,
   more hardcoded paths) — the restructure gets strictly more expensive.
2. **Run both in parallel** — pros: none real; cons: two open trackers, one person, guaranteed
   drift; violates the tracker's single-`## Now` discipline.
3. **Park v2 cleanly** — archive tracker with a parked banner + explicit resume trigger; the
   orchestrator initiative gets the root tracker slot — pros: one honest position at all
   times; the restructure lands on the smaller-today codebase; cons: QA pipeline (Stryker,
   Lighthouse) waits ~6 weeks.

## Decision

Option 3. v2's PLAN/PROGRESS/phase specs moved to docs/archive/ (PLAN-2026-07-17.md,
PROGRESS-2026-07-17.md, phases-v2-2026-07-17/) with parked banners; its appetite clock is
STOPPED at ~13%, not ticking while parked. ADRs 0001–0013 remain live decisions about the
codebase. v2's REQ-08/Phase-8 (plugin install + distribution) ground is partially absorbed
by this initiative — on resume, v2's Phase 8 must be re-scoped against what the orchestrator
shipped (selective install already delivers part of REQ-08's outcome).

## Consequences

Easier: one tracker, one position, the restructure works against a frozen target. Harder:
QA-pipeline gates arrive ~6 weeks later (accepted — v2's own phases closed far under appetite,
so the calendar risk is low). The resume must re-scope v2 Phase 8 explicitly — recorded here
so it cannot be forgotten silently.
