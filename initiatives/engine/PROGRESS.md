# PROGRESS.md — Cycle 9 · arc-engine "Metered Runs"

status: LIVE
cycle: arc-engine (Cycle 9, opened 2026-10-14)
phase: 11
appetite: 2.5d
burn: 0.25d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 8 is archived at `archive/PLAN-cycle8-2026-10-14.md` and `archive/PROGRESS-cycle8-2026-10-14.md`
> (its full done-log lives there); Cycles 6 and 7 beside it. This cycle claims **ADR 0229–0231**.

## Now

- **Phase 11 next** — the steel thread: `spendOf` in `common.mjs`, `generic-api` reading `usage.cost`, `run.completed.spend`, one `cost.incurred` per metered run.
- Branch `feat/engine-c9-metered-runs` in worktree `arc-engine-2`; not merged yet — one merge at the cycle end.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — **parked, shipped in Cycle 6** | — | ✅ done 2026-08-03 |
| 11 | Steel thread for metered runs — `spendOf`, sidecar `spend`, generic-api `usage.cost`, `run.completed.spend`, one `cost.incurred` per metered run (REQ-13) | 0.75 day | ⬜ next |
| 12 | Every production driver reports spend — claude-code `SessionSpend`, hostile corpus, float mutant (REQ-12) | 0.75 day | ⬜ planned |
| 13 | The cap bites — metering flip, live caps with currency, typed refusal, load faults (REQ-14) | 0.75 day | ⬜ planned |
| 14 | Money room live — merge, real main-clone dispatches, `/api/pnl` through the door (REQ-15) | 0.25 day | ⬜ planned |

**Appetite burn: 0.25 of 2.5 days planned (3 cap) — set 2026-10-14: the kickoff, one session.** Phases allocate 2.5.
Kill checkpoint at 1.25 days: Phase 12 not done → scope cut (claude-code's stream path stays `not-reported`).

## Done log

- 2026-10-14 — **Cycle 9 kicked off** (`/arc-kickoff --lane engine`, Tier S). PLAN, 4 phase specs, ADR-0229..0231.
  Owner instruction the same day: build every phase without waiting, push freely, CI only, merge once at the end.

## Self-check

- [ ] `node .claude/scripts/plan/kickoff-lint.mjs --lane engine` clean
- [ ] plan-attacker (merged A+C) reconciled
