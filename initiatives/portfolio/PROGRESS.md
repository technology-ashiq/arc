# PROGRESS.md — portfolio Cycle 5 "the board that notices"

status: LIVE
cycle: arc-portfolio (Cycle 5, opened 2026-10-14)
phase: 04
appetite: 3d
burn: 0d
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
| 04 | Kernel freeze in kickoff-lint + new-cycle detector (REQ-06) | 0.6d | ⏳ next |
| 05 | Debt budget in kickoff-lint (REQ-07) | 0.4d | — |
| 06 | `lane-stale` job, needs-you, board-lint FAIL, render, owner apply (REQ-08) | 0.7d | — |
| 07 | Enforcement rows, wiki, docs, retro and seal (REQ-09) | 0.2d | — |

**Appetite burn: 0 of 3 days used (2 planned).**

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

## Now

**Position: Cycle 5 kicked off; Phase 04 next** — the new-cycle detector and the `[kernel-freeze]` gate
in `kickoff-lint.mjs`, branch `feat/portfolio-cycle-5` (not merged).

**Next step:** write `tests/portfolio-kernel-freeze.bats` red first, then the gate.

blocked-on: —
depends-on: —
