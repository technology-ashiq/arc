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

**Current position:** Phase 00 in build on `feat/discover-birth` — birth rows written (manifest, CATALOG, expected-set, planned-rooms, PORTFOLIO, `/arc-hunt` stub), `tests/discover-birth.bats` red-first.
**Next step:** merge origin/main → face-sections + wiki + sync golden in one commit → `/arc-attack` → one push → CI per job → merge → ruling receipt from the main clone.
