# Phase 01 — The owner sees which gateway each class reaches

**Goal (one line):** the model-policy room shows, for every tier pin and class row, `profile → model @ host` from this machine's store, never the key, or says the profile is missing here (REQ-04).
**Appetite:** 0.75 days
**Depends on:** phase-00
**Serves:** REQ-04
**Branch:** `feat/arc-model-policy-profiles`

## Exit criteria (Definition of Done)
- [x] `hq/lib/face/reads.mjs` `routerRead` serves each class's `profile` and each tier pin's `profile`, plus `model` + `gateway_host` resolved read-only from the store (or `missing: true`); never `key`, never the base-URL path
- [x] `face/src/modules/kernel/model-policy/fold.mjs` renders `profile → model @ host` (or `profile (not on this machine)`) in the tier table and the process-routes table; `View.tsx` unchanged unless a column is added
- [x] A face test plants a recognisable key in a fixture store and proves it is in no `/api/model-policy` body; fold test covers resolved / missing / plain-pin rows
- [x] The face lane's three Settings items (cost, "used by", remove guard — ADR-1803) handed over as one paste-ready `/arc-change --lane face` prompt, recorded in `evidence/phase-01/face-handoff.md`
- [x] Wiki regenerated (`wiki-build --write`) and PORTFOLIO row in step with PROGRESS in the same PR; CI green per job; tracker updated

## Verification plan
- **Test command:** CI `arc-ci` — the face suites that cover `/api/model-policy` and the model-policy fold (`tests/face/*.mjs` via their bats wrappers), plus Phase 00's suites. Never on this box.
- **Expected failure first:** the new fold/route assertions fail with `profile` absent from the served class row (`undefined`) before `routerRead` is extended.
- **Live demo scenario:** start HQ from Git Bash with a store holding `fx`, open the model-policy room: the routes table reads `… → generic-api → fx → <model> @ <host>`.
- **Real-system check:** the owner's own store on the main clone after merge (read-only view).
- **Expected evidence:** CI run id; `evidence/phase-01/face-handoff.md`.

## Rabbit holes in this phase
- Building the Settings "used by" here: it is the face lane's surface (ADR-1803).

## Out of scope for this phase
Settings page, store schema, cost — face lane.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

<!-- Generated from PLAN.md at kickoff; resynced by /arc-change. Never hand-edited. -->
- Tiers are law (ADR-0069): no component changes a tier, driver or profile assignment at run time, and a failing profile never falls to another profile or to the ambient environment.
- A key never reaches argv, a receipt, a log line, a route body or the repo; it travels only in the driver child's environment.
- A profile-resolved run is receipted `model_source: profile` with the actual model id, the profile name and the gateway host — never `router`.
- `--trial-model` and `--owner-model` stay refused on a routed tier; existing `router.yaml` rows resolve byte-identically.
- This cycle does not modify `ModelsPanel.tsx`, `talk.mjs`, `door.mjs`, `arc-dash.mjs`, `models.mjs` or `drivers/generic-api.mjs` (ADR-1803).
- Tests run on CI only, read per job; every suite asserts it ran before asserting what it printed, and a test that passes with the implementation deleted is not a test.
