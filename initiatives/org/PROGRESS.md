✅ 2026-10-05 |✅ 2026-10-05 |✅ 2026-10-05 |✅ 2026-10-05 |# PROGRESS.md — org v2.1 "the four ORG-R holds"

status: IDLE
cycle: arc-org (Cycle 20, opened 2026-10-05)
phase: 03
appetite: 3d
burn: 1d
blocked-on: —
depends-on: —

> Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence at `initiatives/org/evidence/phase-NN/`.
> Cycles 18–19 are archived under `initiatives/org/archive/`. ADR century 1600–1699; ADR-1626..1629 written this cycle.

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | process `role:` slot + resolver + `--trial-seat` in `arc-run` | 0.75d | ✅ 2026-10-05 |
| 01 | `org-judge.mjs` head-judge emission (ORG-O) | 0.5d | ✅ 2026-10-05 |
| 02 | `skill-import.mjs` + `lib/skill-vet.mjs` (pinned, vetted, proposal branch) | 0.6d | ✅ 2026-10-05 |
| 03 | `org-own.mjs` hire-to-own over `agent-scaffold` | 0.5d | ✅ 2026-10-05 |

## Done log

- **Phases 00-03 ✅ 2026-10-05** -- one PR, #325 (squash `8f9e2d25`), CI run 37314038869 @ e5b8622a 19/19 green, ubuntu-20 TAP 4090 ok / 0 not ok incl. 16 org Cycle 20 tests.
  - 00: `role:` on 9 processes, `engine/role-seat.mjs`, `arc-run --trial-seat` (persona only on trial, ADR-1626 amendment). Demo: dry-run names the seat; lint clean.
  - 01: `org-judge.mjs` + the review.completed scorecard arm. Live: refuses NOT_HANDOFF + NO_TEAM on the main spine (no team manifest exists, ADR-1612) -- **REQ-03 is fixture-proven and unused until an `org/teams/*.team.yaml` exists.**
  - 02: `skill-import.mjs` + vet + source. Live: the fake clean skill plans a 7-file branch; `@main` refused UNPINNED; 0 events.
  - 03: `planScaffold` extracted; `org-own.mjs`. Live: the real card refuses NOT_HIRED/NO_HIRE/NO_TIER (no hired seat exists today).
  - Attack: boundary x2 (bc27378: 1 high 2 med; 83b4d22: 2 med), all fixed; logic NOT RUN (deepseek non-JSON, GLM timeout) -> debt row 7. Also fixed main's duplicate `PLAN-launch` key.
  - 1 day vs 2.35d appetite. amendments: 1 (ADR-1626 persona-on-trial-only) · reopened: n · t-to-phase0: 0 days (kickoff 2026-10-05).

**Appetite burn:** 1 of 3 days used (33%; tripwire 50% not reached, every phase done).

## Now

**Current position:** Cycle 20 sealed 2026-10-05 (retro: docs/retro-log.md, HISTORY C20). Lane IDLE.
**Next step:** none queued. Owner: stamp the kickoff and four phase approvals (`arc-inbox approve`). A new org cycle starts by `/arc-kickoff --lane org`.
