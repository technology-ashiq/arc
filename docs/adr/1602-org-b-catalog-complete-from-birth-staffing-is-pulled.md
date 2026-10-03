# ADR 1602 — ORG-B: all 71 roles get cards in Phase 00, vacant ones included; a vacancy fills only after three dispatcher demands

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The demand counter never reaches 3 on any role in the pilot's five days -> the threshold is re-examined in retro, never lowered mid-cycle.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-B). A partial catalog is a wish list; a mass hiring spree is rabbit hole RH-1 (thin agents nobody calls, ~15× tokens when they are). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Complete catalog, pulled staffing** — seated roles get full cards extracted mechanically; vacant roles get generated stubs (`seat: vacant`, `kpi: pending`, mission line only).
2. **Only seated roles** — smaller, but vacancy becomes invisible (breaks REQ-04).

## Decision
Complete catalog. A vacancy is filled only when the dispatcher's vacancy demand counter records **three distinct demands** for it (A8, earn before build). No mass hiring in this cycle.

## Consequences
Easier: the org chart is honest from day one. Harder: 71 files to keep valid — which is exactly what the gate is for.
