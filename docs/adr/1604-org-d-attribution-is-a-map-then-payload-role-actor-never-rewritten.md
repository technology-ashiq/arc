# ADR 1604 — ORG-D: attribution is a derived map first and `payload.role` second; the `actor` field is never rewritten

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** The day-3 kill checkpoint finds fewer than three seated roles with attributable receipts -> the cycle STOPs with the finding recorded (ADR-1612 pause logic does not apply; this is a kill).

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-D). `actor` is load-bearing: `arc-jobs.mjs` forces `scheduler:<name>` and `lib/jobs/audit.mjs` counts any other actor as a MANUAL start. Rewriting it to `role:<id>` breaks the scheduler's own audit. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Map, then payload** — `org/attribution.yaml` maps existing actor / process / kind combinations to roles; newly staffed roles add `payload.role` where the kind's validator accepts it (A-01).
2. **Rewrite actor** — one identity field, but breaks two existing consumers.

## Decision
Map, then payload. A receipt neither layer places is counted **unattributed** and printed with its count — never guessed.

## Consequences
Easier: the scorecard reads today's spine before any emitter changes. Harder: the map is a second file that can rot — coverage checks every map target is a real role.
