# PROGRESS.md — org v2 "the org room"

status: LIVE
cycle: arc-org (Cycle 19, opened 2026-10-03)
phase: 00
appetite: 3d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence at `initiatives/org/evidence/phase-NN/`.
> Cycle 18 is archived under `initiatives/org/archive/`. ADR century 1600–1699; ADR-1624..1625 written this cycle.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | `GET /api/org` + the roles section (71 roles by department) | 1.25d | ⏳ next |
| 01 | Scorecards + teams sections, browser proof both moods | 1.25d | ⏳ |

## Done-log

(none yet)

**Appetite burn:** 0 of 3 days used.

## Now

**Current position:** kickoff 2026-10-03 (tier S). Owner ruling 2026-10-02: build it fully, do not wait, so the
kickoff approval request is recorded and the build proceeds on that standing instruction.
**Next step:** Phase 00 — write `tests/face/org-door.mjs` red first, then `route.mjs`.

**Kickoff attack (tier S, one merged A+C run):** 7 findings, 7 applied. F1's premise ("the door's ctx has no
`root`") was false (`arc-dash.mjs:226` reads `ctx.root`); its mutation was applied with that corrected.
No REJECTED lines.
