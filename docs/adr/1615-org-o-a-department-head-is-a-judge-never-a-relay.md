# ADR 1615 — ORG-O: a department head is a judge, never a relay; a head seat needs ≥2 staffed workers

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** A head's review cost exceeds its workers' combined cost for a month (visible on the scorecard) -> retrain or retire the head seat.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-O). Relay chains lose accuracy at every hop (reported 90.7% → 22.5%). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Head judges artifacts** — dispatcher proposes to workers directly; head reads `handoff.ready`, emits `review.completed`.
2. **Head delegates** (Paperclip CEO → VP → worker) — refused.

## Decision
Judge. Head binds `high-judgment`; workers bind `balanced-workhorse` or `cheap-scan` (ADR-0069 tiers). A head seat is proposed only over ≥2 staffed workers; coverage FAILs otherwise. Team manifests carry `heads:` per department. The emission wiring itself is v2 (ADR-1618).

## Consequences
Easier: two hops max, both receipted. Harder: most heads stay vacant through v1 — rendered, not hidden.
