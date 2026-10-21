# Phase 02 — `qa-run` and `ship-run`: review → QA → Prepare ship from the face

**Goal (one line):** REQ-06 — the review-ship room's QA and Prepare-ship sessions start from a click and land receipts; nothing deploys.
**Appetite:** 2 days
**Depends on:** phase-01
**Serves:** REQ-06
**Branch:** `feat/face-v3-02-qa-ship`

## Exit criteria (Definition of Done)
- [ ] `processes/qa-run.process.yaml` + `hq.policy.yaml` row + `router.yaml` class row (`balanced-workhorse`, ADR-0069 cited); `review-ship.qa` ready; a mock-driver session lands `qa.completed`, read back by the room; a mock run that lands nothing FAILs its arm.
- [ ] `processes/ship-run.process.yaml` runs lint, build, a per-job CI read, then `approval.requested{gate: deploy}`; the `review-ship.ship` row in `face-sessions.mjs` changes in the same PR — label "Prepare ship", `receipt.kind: approval.requested`, `confirmStep: null` (there is no deploy step left to confirm; `sessionsView` forces `processReady: false` while `confirmStep` is set) — and the `CONFIRM_STEP_UNENFORCED` refusal keeps a fixture proving a row WITH a `confirmStep` is still refused; `ship.done` is claimed nowhere; a fixture proves no deploy, publish or push in its compiled argv or any step, and that approving `{gate: deploy}` in the inbox triggers nothing (ADR-1366).
- [ ] Real-side arm: the owner starts QA and Prepare ship once each on a real driver from the face; one `qa.completed` and one `approval.requested{gate: deploy}` are found in `events/` (not `events/_quarantine/`) on the canonical spine.
- [ ] `arc-compile --all` and `gate-parity` green; wiki, sync golden (by its recipe) and `face-sections` regenerated, each `--check` green; two attack surfaces; CI per job; `/arc-phase-done 02` from the main clone.

## Verification plan
- **Test command:** CI per job (`ci-digest.mjs`).
- **Expected failure first:** `gate-parity` and the review-ship room read `processReady: false` for both rows before the files exist; the no-deploy fixture FAILs a planted `vercel` step.
- **Fixtures:** (1) a mock-driver session per process lands its receipt; (2) the no-deploy fixture greps ship-run's compiled argv and every step for deploy|publish|push; (3) each ship-run step is an existing arc script by exact path (`ci-digest.mjs`, the lint script; no `npm test`, none is run on the box), and the step list in the process file is the only place a step can be added.
- **Live demo scenario:** on the owner's main clone, review-ship → QA → Prepare ship from the strip; the inbox shows the deploy gate; nothing deploys.
- **Expected evidence:** the two real receipts' ids, CI run id, `evidence/phase-02/owner-demo.md`.

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
