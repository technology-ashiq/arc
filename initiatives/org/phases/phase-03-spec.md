# Phase 03 — The COO + the review loop

**Goal (one line):** a ₹0 deterministic dispatcher proposes Nilluvai's next jobs daily with goal
ancestry, within a cap of 7 and every seat's budget, for five live days — and the first monthly
`org review` scores every staffed seat.
**Appetite:** 2 days (the 5 heartbeat-days moved to the first venture, ADR-1612 Amendment 1)
**Depends on:** phase-02
**Owner prerequisite:** the `process:org-dispatch` row in `hq.policy.yaml` (ADR-1623) — absent → dry-run only.
**REQs closed here:** REQ-10 (absorbs REQ-12). REQ-08 deferred (ADR-1612 Amendment 1).

## Scope
- `org-dispatch` as a `type: script` job in `hq.jobs.yaml`, `catchup: run`, subject
  `process:org-dispatch` on `processes/org-dispatch.process.yaml` (`job_stub: true`) + its
  `expected-set.json` row; the policy row is the owner's (ADR-1605, ADR-1623, A-04).
- Pilot window opens after 2 consecutive heartbeat receipts; a slept day is not counted (≤ 9 calendar days).
- Arithmetic: unmet stage exit criteria (ADR-1606) → the owning role → `approval.requested` profile
  `org.dispatch` with `{role, task, goal_ancestry: [mission, stage, exit_criterion, task], budget, why_now}`.
- Queue cap 7/day; vacancy demand counter (3 → hire proposal, ADR-1602); budget-cap skip + one
  `approval.requested` `why_now: budget-cap` (ADR-1616); stage-change proposals only.
- Five consecutive elapsed pilot days; accept rate from `decision.recorded` (A-06).
- First `org review --all` with keep · promote · retrain · retire proposals and 30-day tenure (ADR-1607).
- Retro and seal: HISTORY, PORTFOLIO row, lane header in the same commit as the close.

## Exit criteria (Definition of Done)
- [~] REQ-08 — DEFERRED to the first registered venture (ADR-1612 Amendment 1); REQ dropped from this cycle, acceptance carried verbatim in PLAN
- [ ] REQ-10: ≤ 7 proposals/day held or the over-cap day printed; budget-cap arm proven
- [ ] first `org review` receipts; two-surface `/arc-attack` on the dispatcher (ADR-1611); CI green per JOB; tracker updated

## Verification plan
Coarse at kickoff (refined via `/arc-change` when the phase starts): `bats tests/org-dispatch.bats`
red-first over a fixture spine + team manifest; five-day live log from the main clone.

## Build notes (2026-09-30)
- Built: `org/stages.yaml`, `lib/dispatch.mjs`, `org-dispatch.mjs` (dry-run default, `--emit`), `jobs/org-dispatch.mjs` (the scheduler entry, since `hq.jobs.yaml` entries carry no args), `org-review --verdicts` (first review: keep 35 / promote 0 / retrain 1 / retire 1; heartbeat evidence never promotes). Tests: `tests/org-dispatch.bats`, verdict arm in `tests/org-review.bats`.
- Waiting on the owner: the `process:org-dispatch` policy row (`initiatives/org/owner-actions.md`), then the stub + job entry land together; then the five heartbeat-days on the Nilluvai team.

## Out of scope for this phase
Model-written proposals · raising the dispatcher above L1 · a face room for the org chart.

## Your-setup / pending
- Owner: five days of accept / reject on dispatch proposals in `arc-inbox`.

## Non-negotiables (verbatim from PLAN)

- ORG-A: a role card binds existing agents / skills / scripts / processes / router tier and never rewrites `.claude/agents/*.md` (ADR-1601).
- ORG-B: all 71 roles get cards in Phase 00, vacant ones included; a vacancy fills only after three dispatcher demands; no mass hiring (ADR-1602).
- ORG-C / ORG-D: zero new spine kinds; `validate.mjs` untouched; the `actor` field is never rewritten — attribution is the map, then `payload.role`; a needed kind is a vocab ADR with its `GROUPS` row in the same commit (ADR-1603, ADR-1604).
- ORG-E: the dispatcher is a deterministic script-job at ₹0 — proposals only, goal ancestry on every one, queue cap 7, scheduler heartbeat, budget-capped seats skipped, no agent-to-agent calls (ADR-1605).
- ORG-I / ORG-J: `org-coverage.mjs` is FAIL-FROM-BIRTH with `--mutant-selftest`, imports its walkers from `.claude/scripts/core/face-coverage.mjs`, and FAILs any E2 role seated by an agent (ADR-1609, ADR-1610, ADR-1620).
- ORG-N: a seat's `origin` is `own` or `hired`, nothing else; a hired seat names an `arc-run` driver and a router tier, is vetted by `capability-scout`, and is staffed only in the same branch as a bench run over the role's `fixtures` with a human verdict (REQ-11); no seat names a model string (ADR-1614, ADR-1621).
- ORG-O: a department head is a judge, never a relay — the dispatcher proposes to workers directly; the head reads `handoff.ready` and emits `review.completed`; a head seat is proposed only over ≥2 staffed workers and coverage FAILs otherwise; head = `high-judgment`, workers cheaper tiers (ADR-1615).
- ORG-P / ORG-Q: per-seat `budget` in the team manifest is read from `cost.incurred` (zero kinds) and over-cap = stop-and-propose; every card declares `produces` / `consumes` / `escalate_to`, and coverage FAILs an unproduced consumed kind (REQ-13) (ADR-1616, ADR-1617).
- ORG-R: the process `role:` slot, `arc skill import`, head-judge emission and the hire-to-own command are v2 — not built this cycle, triggers recorded (ADR-1618).
- Phase order is catalog+gate → attribution+scorecard → staffing → dispatcher+review; it is never reordered.
- The day-3 kill checkpoint asks whether the attribution map places today's live-spine receipts on at least three seated roles; if not, the cycle STOPs and the finding is recorded (ADR-1604).
- ORG-L: the pilot venture is registered through `venture-register` and is never arc itself (`venture-register.mjs:73`); the five-day pilot runs when the first real venture (Nilluvai or another) is registered, not inside Cycle 18 (ADR-1612 Amendment 1, owner ruling 2026-10-01).
- ORG-M: the org is its own product — `products/org`, data under `org/`, scripts under `.claude/scripts/org/` (ADR-1613).
- The owner ruling of 2026-09-29 is recorded on the spine as a `decision.recorded` before any org file ships, and ADR century 1600–1699 is this lane's only band (ADR-1600).
- Nothing about an unannounced venture's positioning is committed to this public repo; team manifests carry ids, stages, heads and budgets only (ADR-1619).
- `engine/router.yaml` is not edited by this lane; the expired social hire is recorded as it stands (ADR-1622).
- Every gate and the dispatcher get a two-surface adversarial pass by fresh agents, max two rounds per PR (ADR-1611).
- Owner-facing decisions this cycle introduces ride `approval.requested` → `decision.recorded` profiles `org.role` / `org.team` / `org.dispatch`; nothing is auto-approved, auto-renewed or auto-fired (ADR-1603, ADR-1606, ADR-1607, ADR-1608).
- "Tests green" means green on CI, read per JOB with the head SHA asserted; no suite runs on the dev box.
- Phase 00 and Phase 01 each merge on green CI before the next phase opens, so P00–P01 are banked on `main` before the pilot gate; every spine emit (ruling, genesis, `org.*` approvals, phase closes) runs from the MAIN clone after a fetch, never from a worktree.
- The dispatcher's scheduler subject is `process:org-dispatch` on a `job_stub: true` process, and its `hq.policy.yaml` row is authored by the owner — no session edits that file (ADR-1623).
