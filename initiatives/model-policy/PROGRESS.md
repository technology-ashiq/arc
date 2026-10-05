# PROGRESS.md — model-policy v2 "Provider profiles in the model policy"

status: LIVE
cycle: model-policy v2 (opened 2026-10-05)
phase: 00
appetite: 2d
burn: 0.6d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor: Cycle 5 "Balanced Model Policy", CLOSED 2026-08-02 at ~0.7 of 3 days; its tracker is archived in
> `archive/*-cycle5-2026-08-02*`. Its assumption A-06 FIRED 2026-08-16 and was resolved by late proof on 2026-10-04
> (the launch lane's first real `REJECTED:` line) — recorded in the archived PLAN's ledger.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — the engine resolves a profile: load faults, per-hop resolution into child env, missing refuses, receipt (REQ-01, REQ-02, REQ-03) | 1.25 days | 🔨 built — awaiting attack + CI |
| 01 | The owner sees it — `/api/model-policy` + model-policy room show profile → model @ host; face handoff (REQ-04) | 0.75 days | 🔨 built — awaiting attack + CI |

**Appetite burn: ~0.6 of 2 days used (~30%).** Kill tripwire: 1d with Phase 00 open.

## Done-log

*(empty — nothing closed yet)*

## Now

**Position:** kickoff done 2026-10-05; the owner approved building every phase without waiting ("don't wait for me,
ellame neeye pannu ... complete all phase", 2026-10-05). Phase 00 building on `feat/arc-model-policy-profiles`.

Both phases are built on one branch, one PR, per the plan. **Phase 00:** `router-row.mjs` load faults, `arc-run.mjs`
preflight resolution from one store snapshot, child-env-only delivery, exit-2 refusals, the `model_source: profile`
receipt, and `tests/engine-model-profile.bats` (15 tests, recording listener). Live demo in `evidence/phase-00/demo.txt`.
**Phase 01:** `/api/model-policy` serves profile, model and host, never the key; the fold draws `profile → model @ host`;
the face handoff prompt is in `evidence/phase-01/face-handoff.md`. Main was merged in once (one conflict in the
`--dry-run` preview, both sides kept).

**Next:** `/arc-attack` round 1 on the local commit → fix → regenerate the sync golden → one push → ci-digest → merge →
`/arc-phase-done 00` and `01` from the main clone.
