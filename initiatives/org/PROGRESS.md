# PROGRESS.md — org v2 "the org room"

status: IDLE
cycle: arc-org (Cycle 19, opened 2026-10-03)
phase: 01
appetite: 3d
burn: 1d
blocked-on: —
depends-on: —

> Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence at `initiatives/org/evidence/phase-NN/`.
> Cycle 18 is archived under `initiatives/org/archive/`. ADR century 1600–1699; ADR-1624..1625 written this cycle.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | `GET /api/org` + the roles section (71 roles by department) | 1.25d | ✅ 2026-10-03 |
| 01 | Scorecards + teams sections, browser proof both moods | 1.25d | ✅ 2026-10-03 |

## Done-log

- **Phase 00 ✅ 2026-10-03** — `GET /api/org` (ADR-1625) imports org's own producers; the room renders 71 roles in 10
  departments with the six-class counts line. Live on the main clone: counts equal `org/chart.json` (71 · 37 staffed ·
  3 partial · 0 seated · 7 human · 24 vacant). PR #315 (`3c5b14ae`), CI run 37118877736 19/19 green, 3887 ok / 0 not ok
  on ubuntu-20 incl. `org door` (1703) and `org room` (1736). Attack: boundary r1 10 (4 med) + r2 4 (2 med), logic
  r1 on the merged diff 8 (1 high, 3 med) + boundary 6 (3 med) — every high/med fixed or shown not real (debt row 5).
  1 day vs 1.25d. amendments: 0 · reopened: n · t-to-phase0: 0 days (kickoff 2026-10-03).
- **Phase 01 ✅ 2026-10-03** — scorecards (37 staffed seats with verdicts, `no evidence` never 0) and the teams
  section (the ADR-1612 sentence; no team exists). Same PR and CI run; the room opened in the real face in both moods,
  0 console errors, and the session looked at roles, scorecards and teams screenshots before close. Shipped with
  Phase 00, so 0 extra days vs 1.25d. amendments: 0 · reopened: n.

**Appetite burn:** 1 of 3 days used (33%; tripwire 50% not reached, Phase 00 done).

## Now

**Current position:** Cycle 19 sealed 2026-10-03 (retro: docs/retro-log.md, HISTORY C19). Lane IDLE.
**Next step:** none queued. Owner: stamp the two phase approvals (`arc-inbox approve`). A new org cycle starts by `/arc-kickoff --lane org`.

**Kickoff attack (tier S, one merged A+C run):** 7 findings, 7 applied. F1's premise ("the door's ctx has no
`root`") was false (`arc-dash.mjs:226` reads `ctx.root`); its mutation was applied with that corrected.
No REJECTED lines.
