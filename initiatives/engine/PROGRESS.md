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

- **Phases 11, 12 and 13 BUILT on the branch** (not closed: each closes on green CI via `/arc-phase-done`). Phase 11 attacked
  (round 1 at e2dc399: logic 0, boundary 4 -- all fixed); Phase 12 attacked (3e5fc9e: logic 9, boundary 5 -- 4 fixed, 10
  rejected, below); Phase 13 attacked (2f050f5: logic 11, boundary 3 -- 2 fixed, 12 rejected). Next: ONE push and a per-job CI read.
- Branch `feat/engine-c9-metered-runs` in worktree `arc-engine-2`; **not merged yet** — one merge at the cycle end, then
  Phase 14 runs from the main clone.

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

- 2026-10-14 — **Phase 13 attack (2f050f5) reconciled.** Fixed: B2 (an explicit spend null is unproven to the cap whatever
  the class), B3 (spend-trace stat inside the guard). REJECTED: L1, L3, L4, L5 the spend is trusted unvalidated —
  already-covered · L7 a sub-cent spend rounds to 0 — unsupported · L11 generic-api without the opt-in leaves a USD cap
  unprovable — non-actionable · L6 a cap currency no chain driver reports in passes load — non-actionable · B1
  read(null) throws — unsupported · L2 a CLI over-reports a failed session — unsupported · L8, L9, L10 —
  already-covered.
- 2026-10-14 — **Phase 12 attack (3e5fc9e) reconciled.** Fixed: B2/B3 (a paid session whose envelope was lost now reads
  not-reported, never unmetered), B5 (spend-trace flag/path checks). REJECTED: L1, L2, L3, L5, L9 drivers pass the raw
  figure on unchecked — already-covered · L4 cost read only from the result event — already-covered · L6/B4 the
  ARC_LLM_SPEND opt-in is unverified — non-actionable · L7 a zero figure is not spend — unsupported · L8/B1 an empty run_ref
  money row is written — unsupported.
- 2026-10-14 — **Phase 13 fixture migration counted:** 8 test files, 29 edits (every `default:` row runs claude-code, every
  mock row gains `max_cost_currency: INR`); the real router: 11 metered rows + default carry USD caps, hermes stays unmetered.
- 2026-10-14 — **Phase 12 real capture (A-11 held):** claude CLI 2.1.296, json envelope `total_cost_usd` 0.0175131 and stream
  result 0.01478745 (two haiku calls, notional on the owner's subscription), saved verbatim (stream: result event only —
  the init event carries local paths).
- 2026-10-14 — **Cycle 9 kicked off** (`/arc-kickoff --lane engine`, Tier S). PLAN, 4 phase specs, ADR-0229..0231.
  Owner instruction the same day: build every phase without waiting, push freely, CI only, merge once at the end.

## Self-check

- [ ] `node .claude/scripts/plan/kickoff-lint.mjs --lane engine` clean
- [ ] plan-attacker (merged A+C) reconciled
