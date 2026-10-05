# PROGRESS.md — model-policy v2 "Provider profiles in the model policy"

status: IDLE
cycle: model-policy v2 (opened 2026-10-05, closed 2026-10-06)
phase: — (cycle closed)
appetite: 2d
burn: 0.9d
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
| 00 | Steel thread — the engine resolves a profile: load faults, per-hop resolution into child env, missing refuses, receipt (REQ-01, REQ-02, REQ-03) | 1.25 days | ✅ done 2026-10-06 |
| 01 | The owner sees it — `/api/model-policy` + model-policy room show profile → model @ host; face handoff (REQ-04) | 0.75 days | ✅ done 2026-10-06 |

**Appetite burn: ~0.9 of 2 days used (~45%) — CYCLE CLOSED UNDER APPETITE.** The 1d tripwire never fired: Phase 00 was built by ~0.5d. Agent wall-clock, as Cycle 5 cautioned; the owner's own time was the design conversation and one OK.

## Done-log

**Phase 00 — closed 2026-10-06** (REQ-01, REQ-02, REQ-03 validated). `router-row.mjs` load faults for inert or
malformed profiles; `arc-run.mjs` resolves every reachable profile once at preflight from one owner-store snapshot,
delivers URL/key/model through the driver child's env only, refuses a missing profile with exit 2 before any driver
starts, and receipts `model_source: profile` + model id + `profile` + `gateway_host`; named drivers unchanged.
`tests/engine-model-profile.bats`: **17 tests, 51 passes across 3 OS legs, 0 failures** (run 37351833108, head
acbba2bc, merged as bf4fd6a1 in PR #334). Live demo `evidence/phase-00/demo.txt`. Readers of `model_source`: 12 files,
none fails closed (`model-source-readers.md`). Attack round 1 on d63004e: logic 0, boundary 5 (2 medium, 3 low), all 5
fixed in 62e91770 and logged in `fixed-defects.md`; no round 2, by the owner's one-round rule. CI found what the attacker
could not: the new ADR century had no face room (face-coverage `adr-band`), fixed in 10091870. Three Windows flakes on
code this PR never touched (Chrome `EBUSY`, front-door unmount `held=NaN`, narrative signed-approve), each green on
one rerun. Metrics: amendments: 0 · reopened: n · t-to-phase0: 1 day. Time ~0.5d vs 1.25d appetite.

**Phase 01 — closed 2026-10-06** (REQ-04 validated). `/api/model-policy` serves profile → model @ host from this
machine's store, never the key or URL path; unroutable store names listed; the fold draws it in both tables. Proven by
the suite's room case (door + real fold, planted key absent). Settings work handed to the face lane
(`evidence/phase-01/face-handoff.md`). **Real-system read is honestly empty:** `engine/router.yaml` pins no profile yet
(a no-go this cycle — the owner proposes one as their own reviewed diff), so the owner's room shows no profile line
until they do. Metrics: amendments: 0 · reopened: n. Time ~0.4d vs 0.75d appetite. Two main merges mid-CI
(face #332, launch #329) each regenerated the wiki on the merged tree rather than hand-merging it.

## Now

**Position: model-policy v2 CLOSED 2026-10-06.** Both phases done, REQ-01..04 validated, ~0.9 of 2 days. A `generic-api`
pin or a class row can now name a provider profile from the owner's Settings list, and every run says which model and
gateway answered.

**What this cycle did NOT do — so nobody claims otherwise:** no real profile is pinned in `engine/router.yaml` (the
owner's call, as a reviewed diff); the Settings page has no cost, "used by" or remove guard yet (face lane, handoff
filed); `hermes` and `codex` take no profile; no attacker round 2 ran on the fixes.

**Next:** lane IDLE. The owner pastes the handoff prompt into the face session; to route a class to a gateway, add the
record on Settings and propose the one router line (`generic-api: profile:<name>` or a class `profile:`).
