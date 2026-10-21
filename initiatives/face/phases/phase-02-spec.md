# Phase 02 — `qa-run` and `ship-run`: review → QA → Prepare ship from the face

**Goal (one line):** REQ-06 — the review-ship room's QA and Prepare-ship sessions start from a click and land receipts; nothing deploys.
**Appetite:** 2 days
**Depends on:** phase-01
**Serves:** REQ-06
**Branch:** `feat/face-v3-02-qa-ship`

## Exit criteria (Definition of Done)
- [ ] `processes/qa-run.process.yaml` + `hq.policy.yaml` row + `router.yaml` class row (`balanced-workhorse`, ADR-0069 cited); `review-ship.qa` ready; a mock-driver session lands `qa.completed`, read back by the room.
- [ ] `processes/ship-run.process.yaml` runs lint, build, a per-job CI read, then `approval.requested{gate: deploy}`; labelled "Prepare ship"; a fixture proves no deploy, publish or push in its argv or steps (ADR-1366).
- [ ] `arc-compile` and `gate-parity` green; wiki and sync golden regenerated; two attack surfaces; CI per job; the owner starts both from the face; `/arc-phase-done 02`.

## Verification plan
Refined when the phase starts (via `/arc-change`): mock-driver session fixtures for both processes, the no-deploy fixture, CI per job, the owner's live start.

## Rabbit holes in this phase
A new QA runner (wrap the existing path); a real deploy (ADR-1366).

## Out of scope for this phase
`phase-close`, `hire-certify`, `absorb-adopt`, `growth-draft` (their lanes).

## Your-setup / pending
None beyond Phase 01's.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
