# Phase 00 — Steel thread: the engine resolves a profile

**Goal (one line):** a `generic-api` attempt routed by a tier pin `profile:<name>` or a class `profile:` runs on that profile's gateway, model and key, taken from the owner store into the child's environment only; a bad or missing profile is refused before money is spent (REQ-01, REQ-02, REQ-03).
**Appetite:** 1.25 days
**Depends on:** none
**Serves:** REQ-01, REQ-02, REQ-03
**Branch:** `feat/arc-model-policy-profiles`

## Exit criteria (Definition of Done)
- [x] `engine/router-row.mjs` reports the four ADR-1802 load faults (bad class grammar, class profile unreachable, `profile:` under a non-`generic-api` driver in `models`, bare `profile:`); every existing `engine/router.yaml` row still loads with zero faults
- [x] `arc-run.mjs` resolves the model per attempt through ONE function used by the first attempt and every fallback hop: non-`generic-api` → `models[tier][d]`; `generic-api` → class `profile:`, else the tier pin (`profile:<n>` resolves, a plain id stays `router`)
- [x] A resolved profile sets `ARC_LLM_ENDPOINT` (`endpointOf(baseUrl)`), `ARC_LLM_API_KEY` (key or `none`) and `ARC_DRIVER_MODEL` in the driver child's env, overriding any ambient value; nothing of it reaches argv or stderr
- [x] At run start, BEFORE attempt 1, arc-run resolves every profile reachable on the chain (tier pin and class `profile:` for each `generic-api` hop) from ONE store snapshot (ADR-1801). Any miss (store absent, unreadable, no such record, or the store path refused inside the repo) exits 2 naming profile + store path, with no driver started, no receipt and no ambient fall-back. Hops use the snapshot, never a re-read
- [x] Receipt: `model_source: profile`, `model` = record id, payload `profile`, `gateway_host`; `--dry-run` prints the profile and host; BEFORE the push, `git grep -ln model_source -- .claude tests face` lists every reader, each is opened, and the list with its count is recorded in `evidence/phase-00/model-source-readers.md` — every reader that switches on the old values either handles `profile` or is named there as indifferent; `tests/engine-model-seam.bats` gets no edit
- [x] `engine/router.yaml` header documents the grammar and cites ADR-1800..1802 (comments only; no row changes)
- [x] New suite `tests/engine-model-profile.bats` (ASCII names, self-count guard, request-observing assertions via a recording listener, a planted key grepped everywhere; REQ-01's listener asserts the `Authorization` header equals the profile key; a `--driver generic-api` case proves a named driver ignores profiles); `tests/engine-model-seam.bats` unchanged and green
- [x] Two fresh attackers (logic · boundary), round 1 on the local commit before the push. A logic round that times out is re-run on the fallback model BEFORE any fix is made; the logic result exists before merge, or the PR is not merged; CI green per job; tracker updated

## Verification plan
- **Test command:** CI `arc-ci` (bats shards on Windows/macOS/Linux) — `tests/engine-model-profile.bats`, `tests/engine-model-seam.bats`, the router-row tenure suites. Never run on this box.
- **Expected failure first:** before the arc-run change, the REQ-01 fixture (tier pin `profile:fx`, no ambient `ARC_LLM_*`) never reaches the recording listener — arc-run passes `profile:fx` through as a model id and the driver posts to the ambient decoy endpoint (or refuses for lack of one); and `routerFaults` returns `[]` for a class `profile:` on a claude-code-only chain.
- **Fixture rule:** the fixture store lives OUTSIDE the fixture root (`registryPath` refuses a store inside the run's repo).
- **Live demo scenario:** with a scratch store holding `fx` at `http://127.0.0.1:1/v1` and a fixture router, `node .claude/scripts/engine/arc-run.mjs --process commit-msg-draft --driver auto --dry-run --root <fixture>` prints `model <id> (source: profile, profile fx @ 127.0.0.1:1)`; without `--dry-run` it reaches `transport failed`; deleting the record turns it into exit 2 naming `fx`.
- **Real-system check:** n/a — fakes only; no paid run (standing owner rule).
- **Expected evidence:** CI run id with per-job conclusions; `evidence/phase-00/demo.txt` (the three demo outputs).

## Rabbit holes in this phase
- Re-validating store records: `loadRegistry` already does; use its result.
- Touching `generic-api.mjs`: not needed — it already reads exactly the three variables arc-run sets.

## Out of scope for this phase
The face read side (Phase 01) · Settings / store schema (face lane, ADR-1803) · any real router pin.

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
