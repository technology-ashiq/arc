# PROGRESS.md — Cycle 9 · arc-engine "Metered Runs"

status: IDLE
cycle: arc-engine (Cycle 9, opened 2026-10-14)
phase: 14 (cycle closed)
appetite: 2.5d
burn: 1.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 8 is archived at `archive/PLAN-cycle8-2026-10-14.md` and `archive/PROGRESS-cycle8-2026-10-14.md`
> (its full done-log lives there); Cycles 6 and 7 beside it. This cycle claims **ADR 0229–0231**.

## Now

- **CYCLE 9 CLOSED 2026-10-14** -- 4/4 phases, 4/4 REQ validated (REQ-12..15), merged as PR #423 (`1fedd504`).
- Next: the owner's phase stamps (approval ids in the done-log), then a cycle retro if he wants one. The lane is IDLE.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — **parked, shipped in Cycle 6** | — | ✅ done 2026-08-03 |
| 11 | Steel thread for metered runs — `spendOf`, sidecar `spend`, generic-api `usage.cost`, `run.completed.spend`, one `cost.incurred` per metered run (REQ-13) | 0.75 day | ✅ done 2026-10-14 |
| 12 | Every production driver reports spend — claude-code `SessionSpend`, hostile corpus, float mutant (REQ-12) | 0.75 day | ✅ done 2026-10-14 |
| 13 | The cap bites — metering flip, live caps with currency, typed refusal, load faults (REQ-14) | 0.75 day | ✅ done 2026-10-14 |
| 14 | Money room live — merge, real main-clone dispatches, `/api/pnl` through the door (REQ-15) | 0.25 day | ✅ done 2026-10-14 |

**Appetite burn: 1.5 of 2.5 days planned (3 cap) -- CYCLE CLOSED 2026-10-14, all four phases inside the cap.** One long day including three CI rounds and two merges of other lanes' work onto the branch.
Kill checkpoint at 1.25 days: Phase 12 not done → scope cut (claude-code's stream path stays `not-reported`).

## Done log

- 2026-10-14 -- **PHASES 11, 12, 13 AND 14 CLOSED. CYCLE 9 CLOSED. 4/4 phases, 4/4 REQ validated (REQ-12..15 = REQ-A..D).**
  `amendments: 0` · `reopened: n` (each phase). **Actual vs appetite: 1.5 of 2.5 days planned (3 cap).**
  - **CI 19/19, read per job**, run 38549208594 at `fb808a70` = the squash-merged tree `1fedd504` (PR #423). The spend
    suite runs 101 checks in four sections on every leg; 8 fixture files migrated for the metering flip.
  - **REQ-D live:** two real main-clone dispatches -- claude-code 13 USD cents (notional, subscription) and generic-api via
    openrouter.ai 1 USD cent (billed) -- each one cost.incurred, served by /api/pnl through the door, traced by run_ref,
    spend-trace 0 unbooked over 433 runs. Evidence: `evidence/phase-14/`.
  - **CI round 1 (38489875382) was red for three reasons, all fixed in da151269:** propose.mjs edited a row's driver as
    one line while max_cost had become valid only for its chain (every driver proposal and retire produced an unloadable
    router -- now `followMoneyTerm`); `drivers/session-spend.mjs` tripped the runDriver BYPASS gate (SessionSpend moved into
    common.mjs); four test bugs of my own (0.29 is not a float trap; the grep read comments; generic-api run unrouted had
    no model; a driver warning is not on arc-run's stderr on success).
  - **Two other lanes merged onto the branch mid-flight** (launch #410, bench #424 on the same claude-code driver);
    generated files regenerated on the merged tree, never hand-merged.
  - **Receipts (main clone):** phase.closed 11 `01M4X207PWJBSTWGASN7HWSB1C` · 12 `01M4X20HRDKKZQENW1TA8HCR3Q` · 13
    `01M4X20S9J75FTGGR56JAHZHNJ` · 14 `01M4X20XX433TGRHE0Q7TPDPVY`. **Owner stamps owed** (approval.requested, gate phase-done):
    11 `01M4X20BF2EDH6BKEW3FRW0BAH` · 12 `01M4X20Q6P3H37X6FN50DR3XJ6` · 13 `01M4X20VSYT7860GMM32C4Y0YS` · 14 `01M4X20ZMEBVESR2NZAQYCR5PB`.
  - Assumptions: A-11 held (real CLI capture), A-12 held (OpenRouter usage.cost live), A-13 held (fixture), A-14 held
    (main-clone dispatches landed in events/).

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
