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

**Current position:** Phases 01 and 02 are built on fakes. Phase 02's refunds and gate 3 are PR #398 (ADR-1740, ADR-1741).
Phase 03 is built on fakes: seven trust and data slots, ADR-1742..1747, attacked in two rounds. These are security
headers, dependency scan, migration rollback, legal pages, the backup drill, the restore drill and Sentry errors.
Phase 04 is also built on fakes, ADR-1748..1751, attacked in two rounds:
- fit rules carry ids, plan ranks the vetted rows, and an override goes through the inbox;
- the trust sweep covers 28 adapters;
- neon enters the database slot through its row and its adapter only (REQ-08);
- four wiring slots ask arc through `ctx.probe.arc`;
- the weekly `launch-watch` job runs `verify --public-only`.
Phases 03 and 04 ship together in one PR.
**Next step:** merge the Phase 03+04 PR on green CI. Phase 05 (close: `verify --all` on arc-sandbox, the retro) runs
for real once the owner tokens land, and so does each earlier phase's real close.

**Owner actions (one message unblocks every phase's real half):** the `launch-watch` rows: run
`node .claude/scripts/launch/owner-apply-watch-policy.mjs` in the main clone, which writes `hq.policy.yaml` and `hq.jobs.yaml`, then commit both. ·
`GITHUB_TOKEN` · Razorpay test keys plus `RAZORPAY_WEBHOOK_SECRET` · `SENTRY_AUTH_TOKEN` · `NEON_API_KEY` · the `SUPABASE_DB_URL` Actions secret on
arc-sandbox · `CLOUDFLARE_API_TOKEN` (DNS edit, zone automemory.ai) ·
a new `VERCEL_TOKEN` (the current one is invalid) · the Vercel GitHub App installed with access to `arc-sandbox` and the
GitHub login connected to Vercel (browser-only) · `SUPABASE_ACCESS_TOKEN` · `RESEND_API_KEY`. Stamps waiting in
arc-inbox: kickoff `01M40ZHP72PYVBJT17R7A4WZ3W`, owner rulings `01M41MH9JG9VEN5G085T56CNHH` + `01M41MHA25TV1WXYHHGM59ND5V`.
