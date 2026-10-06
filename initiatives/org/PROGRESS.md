# PROGRESS.md — org v2.1 "the four ORG-R holds"

status: IDLE
cycle: arc-org (Cycle 20, opened 2026-10-05)
phase: 04
appetite: 3d
burn: 1.25d
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
| 04 | duplicate-key check in the face contract gates | 0.25d | ✅ 2026-10-06 |

## Done log

- **Phases 00-03 ✅ 2026-10-05** -- one PR, #325 (squash `8f9e2d25`), CI run 37314038869 @ e5b8622a 19/19 green, ubuntu-20 TAP 4090 ok / 0 not ok incl. 16 org Cycle 20 tests.
  - 00: `role:` on 9 processes, `engine/role-seat.mjs`, `arc-run --trial-seat` (persona only on trial, ADR-1626 amendment). Demo: dry-run names the seat; lint clean.
  - 01: `org-judge.mjs` + the review.completed scorecard arm. Live: refuses NOT_HANDOFF + NO_TEAM on the main spine (no team manifest exists, ADR-1612) -- **REQ-03 is fixture-proven and unused until an `org/teams/*.team.yaml` exists.**
  - 02: `skill-import.mjs` + vet + source. Live: the fake clean skill plans a 7-file branch; `@main` refused UNPINNED; 0 events.
  - 03: `planScaffold` extracted; `org-own.mjs`. Live: the real card refuses NOT_HIRED/NO_HIRE/NO_TIER (no hired seat exists today).
  - Attack: boundary x2 (bc27378: 1 high 2 med; 83b4d22: 2 med), all fixed; logic NOT RUN (deepseek non-JSON, GLM timeout) -> debt row 7. Also fixed main's duplicate `PLAN-launch` key.
  - 1 day vs 2.35d appetite. amendments: 1 (ADR-1626 persona-on-trial-only) · reopened: n · t-to-phase0: 0 days (kickoff 2026-10-05).
- **Phase 04 ✅ 2026-10-06** (added by /arc-change from retro 2026-10-05 row 4, ADR-1630) -- PR #339 (squash `6552a0b1`), CI run 37459603738 19/19 green, ubuntu-20 TAP 4150 ok / 0 not ok incl. `dup-keys`. face-sections and face-coverage read the face contracts through `readStrictJson`; the 2026-10-05 shape (PLAN-launch twice) is refused by name. Attack 2655193: logic ran (deepseek, 24 s) and boundary; mediums fixed, rest debt row 8. CI then caught two fixture defects (partial scratch tree, MSYS `tar -C`), both fixed. Also repaired the PROGRESS header the #331 close had corrupted. ~0.25d vs 0.25d. amendments: 0 · reopened: n.

**Appetite burn:** 1.25 of 3 days used (42%; tripwire 50% not reached, every phase done).

## Now

**Current position:** Cycle 20 sealed again 2026-10-06 after Phase 04 (retro rows already in docs/retro-log.md 2026-10-05; Phase 04 was that retro's own row 4). Lane IDLE.
**Next step:** none queued. Owner: stamp the kickoff and five phase approvals (`arc-inbox approve`). A new org cycle starts by `/arc-kickoff --lane org`.
