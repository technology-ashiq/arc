# PROGRESS.md — portfolio Cycle 5 "the board that notices"

status: IDLE
cycle: arc-portfolio (Cycle 5, opened 2026-10-14)
phase: 07 (cycle closed)
appetite: 3d
burn: 1d
blocked-on: —
depends-on: —

> Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in
> `initiatives/portfolio/evidence/phase-NN/`. Cycle 4 is archived at
> `archive/PLAN-cycle4-2026-08-02.md` and `archive/PROGRESS-cycle4-2026-08-02.md`; its phases 00–03
> and evidence stay where they are. ADR-0076..0079 are this cycle's.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 4 | — | ✅ |
| 04 | Kernel freeze in kickoff-lint + new-cycle detector (REQ-06) | 0.6d | ✅ |
| 05 | Debt budget in kickoff-lint (REQ-07) | 0.4d | ✅ |
| 06 | `lane-stale` job, needs-you, board-lint FAIL, render, owner apply (REQ-08) | 0.7d | ✅ (apply: owner-pending) |
| 07 | Enforcement rows, wiki, docs, retro and seal (REQ-09) | 0.2d | ✅ |

**Appetite burn: 1 of 3 days used (2 planned).**

## Done log

- 2026-10-14 — Kickoff: Cycle 4 archived to `archive/`; PLAN.md written with the owner's five locks;
  ADR-0076..0079 recorded (company range, swept 8 worktrees + 320 remote refs, highest found 0075);
  phase specs 04–07; kickoff-lint green (3 WARN: slack, empty deps table, Cycle 4's phase-00 spec);
  spine receipts from the main clone, both found in `events/`, 0 in `_quarantine/`: `kickoff.done`
  `01M4VQTRC1PD35GGNKS4CPRE26`, `approval.requested` `01M4VQTVA4BXAAP06A3FC5H1S8` (the owner's stamp).
  Attack panel (Tier S, one merged A+C run): 7 findings, **7 accepted, 0 rejected** — the job's own
  incident resetting its silence clock, a `cycle:` typo reading as a new cycle, board-lint `--strict`,
  a rehearsal `revenue.received` lifting the freeze, a real-spine demo, CI's base ref, the owner-apply line.
  The owner's same-day message authorised building every phase without waiting and merging once at the end.
- **Phase 04 closed 2026-10-14** (`/arc-phase-done 04 --lane portfolio`): **REQ-06 validated.** Built on
  `feat/portfolio-cycle-5`, PR #422, CI 19/19 on head `507cf1c9` (run 38528394609). `tests/portfolio-kernel-freeze.bats`
  (29, count-guarded) ran `ok` on every leg that carries it, 0 `not ok` (`evidence/phase-07/close.md`).
  Live on the real spine (`evidence/phase-04/live-demo.md`): `memory` refused naming ruling
  `01M4VP8AMYJPMT1MZNQRB0FYY6`, `distribute` Cycle 3 exempt and Cycle 4 refused, `portfolio` passes. A3 held (the
  real ruling text parses). Attack r1 @2df81d4 (logic 10, boundary 7) and r2 @148c6aa (logic 10, boundary 10):
  every high and medium fixed and pinned, fixed-defects (a)–(z), lows to the debt ledger rows 1–6.
  Metrics: `amendments: 0` · `reopened: n`.
- **Phase 05 closed 2026-10-14** (`/arc-phase-done 05 --lane portfolio`): **REQ-07 validated.** Same PR and run;
  `tests/portfolio-debt-budget.bats` (14) green on every carrying leg after one CI round found the test helper
  (`_debt_phase`) rewrote only the original row text (53fed651). Live (`evidence/phase-05/live-demo.md`): every real
  ledger read — face 111, design 45, launch 38, distribute 23 open, so each of those must open its next cycle with
  a named Debt: phase; A4 hand-check 11/11. Merge-time gate: the every-lane sweep on the merged tree is clean.
  Metrics: `amendments: 0` · `reopened: n`.
- **Phase 06 closed 2026-10-14** (`/arc-phase-done 06 --lane portfolio`): **REQ-08 validated on fixtures and a
  real-spine dry run.** Same PR and run; `tests/portfolio-lane-stale.bats` (20) green on every carrying leg. Real
  spine dry run (`evidence/phase-06/live-demo.md`): bench, growth, leads stale (no receipt has ever named them);
  face, launch, portfolio fresh. **Apply: owner-pending** — `hq.jobs.yaml` / `hq.policy.yaml` are deny-floor, so the
  daily schedule lands when the owner runs `owner-apply-lane-stale.mjs`; the first real (non-dry) run is owed from
  the main clone after the merge. Metrics: `amendments: 0` · `reopened: n`.
- **Phase 07 closed 2026-10-14** (`/arc-phase-done 07 --lane portfolio`): **REQ-09 validated.** Enforcement rows
  `action-kickoff-kernel-lane` (advisory), `action-kickoff-over-debt` and `action-board-stale-field` (blocking, each
  with its merge-time bats line); `gate-parity` 0 gaps; PORTFOLIO.md's table headers and separators byte-identical to
  `4741c770`; WARN registry still nine (the new class is a FAIL under `--strict`); wiki `--check` green; two-surface
  attack ran twice (the spec said one round; the cap is two). Retro in `docs/retro-log.md`, HISTORY C25.
  Metrics: `amendments: 0` · `reopened: n`.

## Now

**Position: Cycle 5 SEALED 2026-10-14** — 4/4 phases closed, REQ-06..09 validated, 1 of 3 days. Merged once as
PR #422.

**Owed (not the agent's to do):** the owner runs `node .claude/scripts/core/owner-apply-lane-stale.mjs` from the
main clone, then `node .claude/scripts/hq/jobs-lint.mjs`, then commits `hq.jobs.yaml hq.policy.yaml
processes/lane-stale.process.yaml`; the kickoff stamp `01M4VQTVA4BXAAP06A3FC5H1S8` and the phase move-on stamps are
the owner's (`arc-inbox approve`).

**Next portfolio cycle** starts by `/arc-kickoff --lane portfolio`; debt ledger rows 1–6 are its candidates.

blocked-on: —
depends-on: —
