# Phase 01 — Attribution + scorecard

**Goal (one line):** today's live spine is placed on roles by a derived map, and `org review --role`
re-derives each seat's runs, accepts, rejects, incidents and cost from receipts — or says `no evidence`.
**Appetite:** 1.5 days
**Depends on:** phase-00
**REQs closed here:** REQ-05. Reads for REQ-10's budget half (cost per role) are built here and
enforced in Phase 03.

## Build order

1. **`org/attribution.yaml`** (ADR-1604): rows `{match: {actor?, process?, kind?, payload?}, role}`.
   Generated where a rule is mechanical (`scheduler:*` → PMO; `arc-leads` actor → lead-researcher /
   SDR by kind; `review.completed` from `/arc-review` → code-reviewer; `kickoff.done` →
   product-manager; `phase.closed` → the lane's developer seat), reviewed where not. Every `role` value
   must be a card id — `org-coverage` gains that check. `actor` is read, never rewritten.
2. **`payload.role` read path** — honoured when present (from Phase 02 emits), map used otherwise; the
   two never disagree silently (a receipt with both, pointing at different roles, is a finding). The
   per-kind acceptance table is built HERE: every kind the scorecard reads goes through `validateEvent`
   with a `payload.role` fixture; kinds that reject (at least `decision.recorded`, closed at
   `validate.mjs:232`) are map-only, listed in the bundle (A-01).
3. **`org review --role R [--since D] [--json]`** in `.claude/scripts/org/`: runs (`run.completed`),
   accepts / rejects (`decision.recorded` verdicts over `approval.requested` the role raised), incidents
   (`incident.raised`), cost (`cost.incurred`), handoffs (`handoff.ready`). Zero attributable receipts →
   `no evidence` (never `0%` / `100%`). **Unattributed** receipts printed with their count.
4. **`org review --audit`** recomputes every number from the raw spine by a second, independent pass
   over the same reader and diffs; any non-zero diff exits 1.
5. **Day-3 kill checkpoint** (ADR-1604), run the moment steps 1 and 3 first execute — before `--audit`:
   commit the map's digest first, then run `org review --all --spine-dir MAIN/.claude/state/hq` from the
   worktree (read-only; this reader never emits). Count seated roles holding ≥ 1 `run.completed` or
   ≥ 1 `decision.recorded` verdict placed by a rule naming an actor or process — `scheduler:*`
   heartbeats and kind-only catch-all rows do not count. The role list and the placing receipt ULIDs go
   in the bundle. **< 3 → STOP the cycle, record the finding in PROGRESS and the retro-log, open no
   Phase 02.**
6. **Pilot gate read at close** (ADR-1612): Nilluvai in `ventures.yaml` with an approved
   `ledger.criteria` receipt? No → the cycle pauses here with P00–P01 banked.

## Exit criteria (Definition of Done)
- [ ] attribution map validates; every target is a card id (coverage check added + mutant arm)
- [ ] `org review --role` prints the five derived columns or `no evidence` (REQ-05)
- [ ] `--audit` diff = 0 on the live spine and on the fixture spine
- [ ] day-3 checkpoint recorded: N seated roles measured (N ≥ 3 to proceed), with the list
- [ ] pilot gate read and recorded; PAUSE or STOP flips PROGRESS `status: BLOCKED` with `blocked-on: ashiq — REASON` and rewrites the PORTFOLIO `org` row in the same commit (a paused lane still reading LIVE is a finding)
- [ ] the Phase 01 PR merged on green CI before Phase 02 opens
- [ ] two-surface `/arc-attack` on the scorecard math + spine reader, ≤ 2 rounds (ADR-1611)
- [ ] CI green per JOB, head SHA asserted; tracker updated

## Verification plan

- **Test command:** `bats tests/org-review.bats` (CI only)
- **Expected failure first:** tests-only commit red: `not ok 1 org review derives runs from a fixture spine` with `Cannot find module '.claude/scripts/org/org-review.mjs'`; the zero-receipt case `not ok … prints no evidence` for the same reason — CI run id recorded before the implementation commit.
- **Live demo scenario:** from the main clone, `node .claude/scripts/org/org-review.mjs --all` → a table of seated roles with runs / accepts / rejects / incidents / cost, `no evidence` rows visible, and a footer `unattributed: <n> of <total>`; `--audit` exits 0.
- **Real-system check:** hand-pick 5 receipts from the live spine and confirm the role each lands on matches the map row that placed it.
- **Expected evidence:** `initiatives/org/evidence/phase-01/bundle.md` — review table, audit diff output, day-3 count + role list, pilot-gate reading.

## Rabbit holes in this phase
- Inventing a kind to make a role measurable → ADR-1603: vocab ADR + `GROUPS` row, same commit, never silent.
- Guessing attribution for ambiguous receipts → count them unattributed.

## Out of scope for this phase
Emitter changes (Phase 02 adds `payload.role`) · budget enforcement (Phase 03).

## Your-setup / pending
- Owner: Nilluvai registration decided by this phase's close (ADR-1612).

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
