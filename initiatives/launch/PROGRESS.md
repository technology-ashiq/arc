# PROGRESS.md — launch v1 "the venture factory"

status: LIVE
cycle: arc-launch (Cycle 1, opened 2026-10-03)
phase: 01
appetite: 18d
burn: 6d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/launch/evidence/phase-NN/`.
ADR century 1700–1799; ADR-1700..1724 written at kickoff.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contracts + registry + lint + durable runner on fakes | 2.5d | ✅ 2026-10-04 |
| 01 | Steel thread on `arc-sandbox` (day-3 kill inside) | 5d | ⏳ next |
| 02 | Money, test mode | 3d | ⏳ |
| 03 | Trust + data minimum | 2d | ⏳ |
| 04 | Recommendation + REQ-08 + trust runtime + wiring + drift + teardown | 2d | ⏳ |
| 05 | Close | 1d | ⏳ |

## Done-log

- **Phase 00 ✅ 2026-10-04** — 85-slot catalog (33 core · 35 required · 17 optional, copied row for row) + 35 provider
  rows (all candidate, Stripe blocked) + `arc-sandbox` profile; `launch-lint` fails from birth and its self-test refuses
  13/13 mutants after a clean baseline; `launch-coverage` derives every count; the durable runner (lock, child worker
  killed at the slot timeout, resource tags, orphan-attempt receipt) and the `ctx` trust boundary. PR #320 (`9827782d`),
  CI run 37146455574 19/19 green, **44/44 launch tests** on every leg. Attack: logic r1 3 + r2 2, boundary 15 + 15 —
  every high/medium fixed; 2 lows + 1 follow-up in `debt-ledger.md`; 25 patterns in `fixed-defects.md`. CI run
  37144642041 was red on two causes (CATALOG row, a Windows-only CR guard), both fixed. 1 day vs 2.5d.
  amendments: 0 · reopened: n · t-to-phase0: 1 day (kickoff 2026-10-03).

**Appetite burn:** 6 of 15.5 days planned (calendar, 2026-10-03..09; 18-day cap; 33%). Day-7.5 checkpoint (Phase 01
closed?) falls 2026-10-10: Phase 01 is built on fakes and waits only on the owner tokens below, so that checkpoint is a
scope-cut conversation unless the tokens land. 50% tripwire at the Phase 02 exit (9 days).

## Now

**Current position:** Phase 01 every slot built on fakes (#322..#359, ADR-1725..1735); its real half waits on the owner
actions below. Phase 02 built on fakes, fakes-first by the owner ruling: payment-test #360 (ADR-1736), plans #363
(ADR-1737), checkout-portal #386 (ADR-1738), webhooks-ledger #387 (ADR-1739), and on `feat/launch-p02-gate3` refunds
(ADR-1740: a stored `refund.processed` books against its charge, `arc pnl --simulated` nets to 0) + gate 3 (ADR-1741:
`apply payment-live` on arc-sandbox records `approval.requested` and exits 2 before dependencies or provider).
**Next step:** ledger-source (REQ-10 `ledger-source` registered), then Phase 03 on fakes. Phase 02 closes on the real
test-mode purchase once the Razorpay keys and the Phase 01 tokens land.

**Owner actions (one message unblocks Phase 01's real half):** `CLOUDFLARE_API_TOKEN` (DNS edit, zone automemory.ai) ·
a new `VERCEL_TOKEN` (the current one is invalid) · the Vercel GitHub App installed with access to `arc-sandbox` and the
GitHub login connected to Vercel (browser-only) · `SUPABASE_ACCESS_TOKEN` · `RESEND_API_KEY`. Stamps waiting in
arc-inbox: kickoff `01M40ZHP72PYVBJT17R7A4WZ3W`, owner rulings `01M41MH9JG9VEN5G085T56CNHH` + `01M41MHA25TV1WXYHHGM59ND5V`.
