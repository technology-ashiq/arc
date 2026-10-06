# PROGRESS.md — discover v2 "the idea engine"

status: LIVE
cycle: arc-discover (Cycle 1, opened 2026-10-06)
phase: 01
appetite: 8d
burn: 2d
blocked-on: Ashiq — council spend OK + the REQ-07 niche
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/discover/evidence/phase-NN/`.
ADR century 1900–1999; ADR-1900..1912 written at kickoff, 1913–1914 at the Phase 00 build. Kickoff APPROVED by the owner in chat 2026-10-06 ("approved, machi work start pannu … complete all phase"); the `approval.requested` receipt is emitted from the main clone after the birth PR merges.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + ruling on the spine + audit memo | 1d | ✅ |
| 01 | Hostile hunt on fakes + recorded replay + live mini-hunt (day-4 kill, 50% tripwire) | 3d | ⏳ next |
| 02 | Evidence-traced scoring + council + evolve reader | 2d | ⏳ |
| 03 | Inbox gate + venture.yaml exporter + money seed + real hunt + retro | 2d | ⏳ |

## Done-log

- **Kickoff 2026-10-06**: PLAN, 4 phase specs, ADR-1900..1912. Verification corrected four design-source premises (ADR-1910 closed council payload; ADR-1911 HN adapter fields; ADR-1912 profile acceptor; spine is 46 kinds). The market-analysis agent was not found on disk (A-01). The attack panel (3 attackers, 21 findings, 20 applied, 1 rejected) split the birth PR out as Phase 00, so the plan is 8d against an 8d cap with zero slack.
- **Phase 00 closed 2026-10-07** (`/arc-phase-done 00`): the birth PR #343 (`8d296874`) went 19/19 on CI run 37419306766 (discover-birth.bats has 7 tests, plus face-coverage, portfolio-board, sync, wiki-coverage and product-lint). The ruling `approval.requested` `01M47ZCQW6XF5ZEWF4QGS1XFRH` was decided by the owner's `decision.recorded` `01M4982PTC62ZM2WF6YWN8KRZR` (approve). Neither is in `_quarantine/` (13 files, 0 discover). Audit memo: NOT LOCATABLE. REQ-10 validated. Actual time 1d against a 1d appetite, plus about 1 day of waiting on the stamp. Metrics: `amendments: 2` (ADR-1913 policy row, ADR-1914 face room; ADR-1915 withdrew the growth ask) · `reopened: n` · `t-to-phase0: 1`. Close receipts (main clone): `phase.closed` `01M498S0NPEP8YBS4QKF80JG4W` and the move-on `approval.requested` `01M498S1YMNKJVYRM3YY8KNNY4`, both `discover@1.0.0`. A first emit with a bare `--process discover` was refused `BAD_PROCESS` and its two records sit in `_quarantine/2026-10-07.jsonl`. They are not the ruling receipts.

**Appetite burn:** 2 of 8 planned days used (25%; the 50% tripwire is the Phase 01 exit on day 4) (8-day cap, 0 slack). Phases 00–03 code built and merged on day 1 (#343, #350); the remaining burn is live runs and owner stamps.

## Now

**Current position:** All code merged — birth #343 (`8d296874`), Phases 01–03 #350 (`e959e0b1`), both CI 19/19. Live on the canonical spine: `kickoff.done`, the ruling request `01M47ZCQW6XF5ZEWF4QGS1XFRH` (stamped approve, `01M4982PTC62ZM2WF6YWN8KRZR`); Phase 00 closed 2026-10-07, a live mini-hunt with 45 `idea.captured` + 2 `run.completed`, 0 quarantined. Evidence: `evidence/phase-00..02/`.
**Next step:** `/arc-phase-done 01` from the main clone. Then, with the owner's spend OK and niche: `judge --run` (two real `council.verdict`) → close 02 → the REQ-07 real hunt → `propose` → the owner's approve/reject → `export` → close 03 + retro.
