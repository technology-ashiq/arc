# Phase 00 — Steel thread

**Goal (one line):** thinnest deployable slice: request → handler → fake DB → response, deployed.
**Appetite:** 2 days
**Depends on:** none

## Exit criteria (Definition of Done)
- [ ] `GET /` returns "hello" end-to-end on the deployed URL
- [ ] tests added & green
- [ ] contract tests green against fakes
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `npm test -- steel`
- **Expected failure first:** `steel.test.ts` fails with "connect ECONNREFUSED" before the handler exists
- **Live demo scenario:** open deployed URL, see "hello" within 2s
- **Real-system check:** n/a — fakes only this phase
- **Expected evidence:** test output + deployed URL screenshot

## Rabbit holes in this phase
None known.

## Out of scope for this phase
Real DB (phase 1).

## Your-setup / pending
Hosting account token.

## Non-negotiables (verbatim from PLAN)

- Tests per feature — no untested code merges
- No secrets in code — env only
- CI green before merge
