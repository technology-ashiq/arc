# ADR 1603 — ORG-C: zero new spine kinds; `validate.mjs` is not touched; a needed kind is a vocab ADR with its `GROUPS` row in the same commit

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** Phase 01 proves a staffed role cannot be measured from existing kinds -> a vocab ADR in this band, `GROUPS` row in `arc-brief.mjs` in the same commit.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-C). `validate.mjs` is a shared organ and records a 44→46 two-lane collision. ADR-0217 (hires) and ADR-1017 (`ledger.criteria`) both governed new state with `approval.requested` subject profiles at zero kinds. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Three subject profiles** on `approval.requested` → `decision.recorded`: `org.role` (catalog, genesis, hires), `org.team` (team manifests), `org.dispatch` (dispatch proposals, incl. budget-cap stops).
2. **New kinds** (`role.staffed`, `dispatch.proposed`, …) — clearer names, but a shared-organ edit and a collision risk.

## Decision
Three profiles, zero kinds. Performance reads only existing kinds (`run.completed`, `approval.requested`, `decision.recorded`, `review.completed`, `incident.raised`, `cost.incurred`, `handoff.ready`, `slice.done`, `content.published`, `outreach.sent`, …).

## Consequences
Easier: no cross-lane vocabulary change. Harder: profile names must be validated by org's own readers, not by the spine.
