# Phase 02 — Staffing

**Goal (one line):** Nilluvai is staffed from the catalog by a digest-governed team manifest, installs
exactly its staffed seats, and no seat reaches `staffed` without a hire branch and a bench interview.
**Appetite:** 2.5 days
**Depends on:** phase-01
**REQs closed here:** REQ-06, REQ-07, REQ-11 (absorbs REQ-09).

## Scope
- `org/teams/<venture>.team.yaml` schema: `venture · stage · mission (public-safe line | private) ·
  on_shift · heads · seats (incl. per-seat budget) · budget · dispatch {heartbeat, queue_cap: 7}`
  (ADR-1606, ADR-1615, ADR-1616, ADR-1619); `org.team` digest governance (A-03).
- `sync-to-project <dir> --team <venture>` via `arc-products.mjs` (REQ-07).
- Nilluvai team staffed at stage `discover`/`validate` (ADR-1612); E2 seats `human:ashiq`.
- **Ordered, with a cut line:** (1) team schema + `org.team` digest gate → REQ-06 · (2) `sync --team`
  golden → REQ-07 · (3) hire path (`agent-scaffold` or router hire + card change in one proposal
  branch) + ONE bench interview with a human verdict on the pilot's first seat → REQ-11 (ADR-1614;
  A-07 hand-record fallback) · (4) fixtures, KPIs and `docs/schemas/*.md` for the pilot's staffed
  roles only (ADR-1617, RH-4). **Cut line at cycle day 7.0:** anything in (5)–(7) not started goes to
  `debt-ledger.md` · (5) `payload.role` on kinds Phase 01 found open (A-01) · (6) three skills
  (ADR-1608), pilot-pulled one first, then `council-consult`, then `support-reply` · (7) `generic-api`
  dry run only at ₹0 and if time remains, else `unproven-live` (ADR-1621).

## Exit criteria (Definition of Done)
- [ ] REQ-06, REQ-07, REQ-11 acceptance lines pass on CI; mutant arms name their plants
- [~] Nilluvai team manifest approved by `decision.recorded` over its digest — DEFERRED to the first registered venture (ADR-1612 Amendment 1)
- [~] ≥ 1 seat staffed through a real hire branch + interview verdict — DEFERRED to the first registered venture (ADR-1612 Amendment 1)
- [ ] two-surface `/arc-attack` on digest gate + sync `--team` (ADR-1611); CI green per JOB; tracker updated

## Verification plan
Coarse at kickoff (refined via `/arc-change` when the phase starts): `bats tests/org-team.bats` +
`tests/org-sync-team.bats` red-first, golden install diff = 0, one interview receipt read back.

## Build notes (2026-09-30)
- Built: `lib/team.mjs` + `org-team.mjs` (`--init/--validate/--digest/--check/--products-for`), `sync-to-project --team` in both twins over the one `--products` installer, `org-catalog --hire` verifying the interview on the spine, `org-coverage --spine-dir`, M14, three skills (council-consult, outreach-draft, support-reply) as capabilities. Tests: `tests/org-team.bats` (REQ-06 governance incl. a near-miss subject, REQ-07 `--team` vs `--products` byte-identical install, REQ-11 hire refusals).
- `--init` puts VACANT roles on shift, so the dispatcher can count demand for them.
- Waiting on the owner: Nilluvai registration, then the pilot team, its approval, pilot fixtures/KPIs/schemas and one interview (A-07 hand-record if bench cannot express it).

## Out of scope for this phase
Dispatcher and review loop (Phase 03) · process `role:` slot, `arc skill import`, head-judge emission, hire-to-own command (ADR-1618).

## Your-setup / pending
- Owner: Nilluvai registration is no longer a gate for this phase (ADR-1612 Amendment 1, 2026-10-01); the pilot parts run with the first venture.
- Owner: approve the team digest and each interview verdict.

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
