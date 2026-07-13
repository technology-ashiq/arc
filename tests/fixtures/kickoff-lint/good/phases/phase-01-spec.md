# Phase 01 — Real DB + health

**Goal (one line):** swap fake DB for Postgres (ADR 0001); add `/health` with build sha.
**Appetite:** 3 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)
- [ ] `/health` returns 200 + sha on deployed URL
- [ ] contract tests green against the REAL Postgres
- [ ] tracker updated

## Verification plan
One coarse line: refine when the phase starts — health endpoint + real-DB contract pass.

## Rabbit holes in this phase
Connection pooling — use platform defaults.

## Out of scope for this phase
Auth, billing.

## Your-setup / pending
Postgres connection string.

## Non-negotiables (verbatim from PLAN)

- Tests per feature — no untested code merges
- No secrets in code — env only
- CI green before merge
