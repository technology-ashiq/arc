# PROGRESS.md — launch v1 "the venture factory"

status: LIVE
cycle: arc-launch (Cycle 1, opened 2026-10-03)
phase: 00
appetite: 18d
burn: 0d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/launch/evidence/phase-NN/`.
ADR century 1700–1799; ADR-1700..1724 written at kickoff.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contracts + registry + lint + durable runner on fakes | 2.5d | ⏳ next |
| 01 | Steel thread on `arc-sandbox` (day-3 kill inside) | 5d | ⏳ |
| 02 | Money, test mode | 3d | ⏳ |
| 03 | Trust + data minimum | 2d | ⏳ |
| 04 | Recommendation + REQ-08 + trust runtime + wiring + drift + teardown | 2d | ⏳ |
| 05 | Close | 1d | ⏳ |

## Done-log

(none yet)

**Appetite burn:** 0 of 15.5 days planned (18-day cap). 50% tripwire at the Phase 02 exit (9 days).

## Now

**Current position:** kickoff 2026-10-03 (tier L). Owner standing instruction the same day: build every phase
without waiting, push freely, CI is the only test runner — so the kickoff approval request is recorded and the
build proceeds on that instruction.

**Kickoff gates:** kickoff-lint green · attack ×3 (A, B, C): 21 findings, 20 applied (duplicates merged), 1
REJECTED (`violates-no-go`, REQ-12 is owner-locked) · simulation gate 11 → 3 blockers in two rounds; the gate rule
makes a second non-zero round the owner's call, but all three were information the executor holds (the frozen
catalog, an adapter rule, one command), so they were closed in `phase-00-spec.md` C1b/C3b/C10 under the standing
instruction and this line is the record · tier-L re-verify by researcher (3 claims; findings folded into PLAN
§Evidence) · cross-model second opinion **UNAVAILABLE** (Codex refused every model on this ChatGPT account).

**Next step:** Phase 00 — write `tests/launch-lint.bats` and `tests/launch-runner.bats` red first, then the
catalog, registry, lints and runner.

**Owner actions ahead (one line each, not blocking Phase 00):** before Phase 01 — `CLOUDFLARE_API_TOKEN` (DNS edit,
zone automemory.ai) and a valid `VERCEL_TOKEN`; before Phase 02 — Razorpay test keys; before Phase 04 —
`NEON_API_KEY` (ADR-1724).
