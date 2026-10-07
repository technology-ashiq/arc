# PROGRESS.md — discover v2 "the idea engine"

status: IDLE
cycle: arc-discover (Cycle 1, sealed 2026-10-07)
phase: 03
appetite: 8d
burn: 2d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/discover/evidence/phase-NN/`.
ADR century 1900–1999; ADR-1900..1912 written at kickoff, 1913–1914 at the Phase 00 build. Kickoff APPROVED by the owner in chat 2026-10-06 ("approved, machi work start pannu … complete all phase"); the `approval.requested` receipt is emitted from the main clone after the birth PR merges.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + ruling on the spine + audit memo | 1d | ✅ |
| 01 | Hostile hunt on fakes + recorded replay + live mini-hunt (day-4 kill, 50% tripwire) | 3d | ✅ |
| 02 | Evidence-traced scoring + council + evolve reader | 2d | ✅ |
| 03 | Inbox gate + venture.yaml exporter + money seed + real hunt + retro | 2d | ✅ |

## Done-log

- **Kickoff 2026-10-06**: PLAN, 4 phase specs, ADR-1900..1912. Verification corrected four design-source premises (ADR-1910 closed council payload; ADR-1911 HN adapter fields; ADR-1912 profile acceptor; spine is 46 kinds). The market-analysis agent was not found on disk (A-01). The attack panel (3 attackers, 21 findings, 20 applied, 1 rejected) split the birth PR out as Phase 00, so the plan is 8d against an 8d cap with zero slack.
- **Phase 00 closed 2026-10-07** (`/arc-phase-done 00`): the birth PR #343 (`8d296874`) went 19/19 on CI run 37419306766 (discover-birth.bats has 7 tests, plus face-coverage, portfolio-board, sync, wiki-coverage and product-lint). The ruling `approval.requested` `01M47ZCQW6XF5ZEWF4QGS1XFRH` was decided by the owner's `decision.recorded` `01M4982PTC62ZM2WF6YWN8KRZR` (approve). Neither is in `_quarantine/` (13 files, 0 discover). Audit memo: NOT LOCATABLE. REQ-10 validated. Actual time 1d against a 1d appetite, plus about 1 day of waiting on the stamp. Metrics: `amendments: 2` (ADR-1913 policy row, ADR-1914 face room; ADR-1915 withdrew the growth ask) · `reopened: n` · `t-to-phase0: 1`. Close receipts (main clone): `phase.closed` `01M498S0NPEP8YBS4QKF80JG4W` and the move-on `approval.requested` `01M498S1YMNKJVYRM3YY8KNNY4`, both `discover@1.0.0`. A first emit with a bare `--process discover` was refused `BAD_PROCESS` and its two records sit in `_quarantine/2026-10-07.jsonl`. They are not the ruling receipts.
- **Phase 01 closed 2026-10-07** (`/arc-phase-done 01`): REQ-01 and REQ-02 are validated. The build is #350 (`e959e0b1`), which went 19/19 on CI run 37429716067. `discover-miner.bats` (now 12 tests, with the COULD_NOT_SCAN zero-tap arm added in #355) and `discover-cluster.bats` (7 tests) pass. In the live demo, from the main clone, two `hunt --offline-fixture recorded/hn.json` runs printed `4bc7da14…0ceb`, which equals the committed golden. The live mini-hunt produced 45 `idea.captured` and 0 quarantined. The day-4 kill question was answered NO-KILL on day 2. Actual time was ~1d against a 3d appetite. Metrics: `amendments: 0` · `reopened: n`.
- **Phase 02 closed 2026-10-07** (`/arc-phase-done 02`): REQ-03, REQ-04 and REQ-08 are validated. CI: `discover-score.bats` (6 tests) and `discover-council.bats` (6 tests). Live: the owner OK'd the `claude-code` driver (₹0 cash). `judge --run` gave two real `council.verdict`, `01M49BHH0N45KQSFT1BSB5YVTK` and `01M49CA9TAAN0YSC8WXXPFKY80`, both hold/Medium and both found by id in `events/`. The verification plan was the coarse one-liner, so the executed command list in `evidence/phase-02/README.md` stands as its refinement. Actual time was ~0.5d against a 2d appetite. Metrics: `amendments: 0` · `reopened: n`.
- **Phase 03 closed 2026-10-07** (`/arc-phase-done 03`): REQ-05, REQ-06, REQ-07 and REQ-09 are validated. The REQ-07 real hunt on `invoice reminders` ran from the main clone and took 28.2 min from hunt start to the shortlist reaching the inbox (target < 60). The owner chose approve-as-rehearsal, recorded as `decision.recorded` `01M49CEWSXE7Q1GFZS24HMZY5S`. `export` then wrote `invoice-reminders-6e390c.venture.yaml` (accepted by launch `loadProfile`, 61/85 slots) plus `.hunt.md`, both committed in #355. The money seed is honestly ABSENT, because none of the posts names a price, and 0 `revenue.*` events were emitted. Actual time was ~0.5d against a 2d appetite. Metrics: `amendments: 0` · `reopened: n`. Close receipts (`discover@0.1.0`): `phase.closed` 01 `01M49CQW93BN1S406EWX2PF20T` · 02 `01M49CQXDKW0RWN4VFZE3ZAHN5` · 03 `01M49CQYFGSWCH6SFN6A0VAMPJ`; move-on requests 01 `01M49CQWW1GKMKGF55R63PX3NA` · 02 `01M49CQY0HYH36WC8XMR0W1RY0` · 03 `01M49CQYXMWX5TKKXCX2GZ105B`. The retro is owed (`/arc-retro --lane discover`).

**Appetite burn:** 2 of 8 planned days used (25%). All four phases closed on day 2, so the 50% tripwire (Phase 01 exit, day 4) was never reached. Code was built and merged on day 1; day 2 went to the live council, the real hunt and the closes.

## Now

**Current position:** All four phases are closed (2026-10-07). The real hunt on `invoice reminders` went from hunt to inbox in 28.2 min, gave 2 council verdicts (hold/Medium), and was approved as rehearsal and exported to `products/launch/ventures/invoice-reminders-6e390c.venture.yaml`. Close PR #355.
**Next step:** none — Cycle 1 is sealed (retro 2026-10-07). The next discover cycle starts with `/arc-kickoff --lane discover`.
