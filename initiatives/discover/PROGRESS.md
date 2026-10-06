# PROGRESS.md — discover v2 "the idea engine"

status: LIVE
cycle: arc-discover (Cycle 1, opened 2026-10-06)
phase: 00
appetite: 8d
burn: 0d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/discover/evidence/phase-NN/`.
ADR century 1900–1999; ADR-1900..1912 written at kickoff, 1913–1914 at the Phase 00 build. Kickoff APPROVED by the owner in chat 2026-10-06 ("approved, machi work start pannu … complete all phase"); the `approval.requested` receipt is emitted from the main clone after the birth PR merges.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + ruling on the spine + audit memo | 1d | ⏳ next |
| 01 | Hostile hunt on fakes + recorded replay + live mini-hunt (day-4 kill, 50% tripwire) | 3d | ⏳ |
| 02 | Evidence-traced scoring + council + evolve reader | 2d | ⏳ |
| 03 | Inbox gate + venture.yaml exporter + money seed + real hunt + retro | 2d | ⏳ |

## Done-log

- **Kickoff 2026-10-06**: PLAN, 4 phase specs, ADR-1900..1912. Verification corrected four design-source premises (ADR-1910 closed council payload; ADR-1911 HN adapter fields; ADR-1912 profile acceptor; spine is 46 kinds). The market-analysis agent was not found on disk (A-01). The attack panel (3 attackers, 21 findings, 20 applied, 1 rejected) split the birth PR out as Phase 00, so the plan is 8d against an 8d cap with zero slack.

**Appetite burn:** 0 of 8 planned days used (8-day cap, 0 slack).

## Now

**Current position:** Phase 00 birth merged (#343, `8d296874`). Receipts on the canonical spine: `kickoff.done` `01M47ZCQMHWB54E808DEZXGJH6`, ruling `approval.requested` `01M47ZCQW6XF5ZEWF4QGS1XFRH`. The audit memo is NOT LOCATABLE. Phases 01–03 code is in the build PR on `feat/discover-p01`, which also carries the Phase 00 close evidence (one CI run instead of two).
**Next step:** build PR → CI → merge. Then from the main clone: the live mini-hunt (Phase 01), the council on the finalists (Phase 02, spend needs the owner OK), and propose → owner stamp → export → real hunt (Phase 03). The owner stamps the ruling (`arc-inbox approve 01M47ZCQW6XF5ZEWF4QGS1XFRH`) before `/arc-phase-done 00`.
