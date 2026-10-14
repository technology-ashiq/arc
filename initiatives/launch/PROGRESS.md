# PROGRESS.md — launch v1 "the venture factory"

status: LIVE
cycle: arc-launch (Cycle 1, opened 2026-10-03)
phase: 04
appetite: 18d
burn: 12d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/launch/evidence/phase-NN/`.
ADR century 1700–1799; ADR-1700..1724 written at kickoff.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contracts + registry + lint + durable runner on fakes | 2.5d | ✅ 2026-10-04 |
| 01 | Steel thread on `arc-sandbox` (day-3 kill inside) | 5d | ✅ 2026-10-14 |
| 02 | Money, test mode | 3d | ✅ 2026-10-14 |
| 03 | Trust + data minimum | 2d | ✅ 2026-10-14 |
| 04 | Recommendation + REQ-08 + trust runtime + wiring + drift + teardown | 2d | ⏳ next |
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
- **Phase 01 ✅ 2026-10-14** — the steel thread runs for real on `arc-sandbox`. Day-3 kill answered YES:
  `sandbox.automemory.ai` answers 200 from a git-triggered Vercel deploy, and the state file resumes (`apply --again`,
  ADR-1760). 16 slots are verified live: repo, ci, environments, hosting, dns, tls, secrets, release, frontend, backend,
  database, orm, email-transactional, auth, authz, tenancy.
  - auth: login 303 → me 200 → logout 200 → after 401.
  - authz: cross-tenant 403.
  - tenancy: invite 201 → join 200 → scoped 200 / out-of-scope 403.
  - frontend: PageSpeed 100/100/100/100.
  Every Phase 01 adapter's real verify is recorded, redacted and replayed on CI (ADR-1761). PRs #410 (`d8f943a0`),
  #425 (with the replay). CI per job in `evidence/phase-01/test-output.log`. **272 launch tests.** Bugs found live and
  routed through /arc-change: release READY-only (ADR-1755), the auth stock template, auth SMTP via Resend (ADR-1756),
  the public Supabase values (ADR-1757), PageSpeed with the owner's key (ADR-1753), the CSP nonce (ADR-1754).
  10 days vs 5d. amendments: 7 · reopened: n.
- **Phase 02 ✅ 2026-10-14** — REQ-04 on `arc-sandbox`, Razorpay test mode:
  - plans: pro 200, downgraded 403 on a gated route.
  - checkout-portal and payment-test: test orders.
  - webhooks-ledger: 2 replays of one webhook store 1 event.
  - ledger-source: exactly `revenue.simulated` (2 events: the purchase and its refund).
  - refunds: rfnd_ArcProbe…, nets cash-in to 0 in `arc pnl --simulated` on the labelled simulated line.
  - payment-live: REFUSED at gate 3 (approval.requested 01M4VRAKRFHJJKHGPSEM6YZTA9; refusal proven, never crossed).
  The 50% tripwire was checked: it fired at day 12, and the scope-cut decision cuts nothing (ADR-1762). 1 day of real run
  vs 3d. amendments: 1 (ADR-1760) · reopened: n.
- **Phase 03 ✅ 2026-10-14** — REQ-06. Every verified slot names its outside answerer:
  - DNS from 8.8.8.8 and 1.1.1.1.
  - TLS A/A with HSTS.
  - security-headers A+ (110) with 9 nonced scripts.
  - backup: `pg_dump` over the session pooler, restored into a Supabase-shaped scratch with every table's row count
    equal (venture CI run 38479353075, step "restore and compare row counts").
  - restore-drill: reads that digest.
  - errors: a Sentry issue from a thrown probe.
  - dependency-scan: green on the venture CI after the shell pins (ADR-1759).
  - migration-rollback: down migration on CI.
  legal-pages is a named ABSENT (renderer not ready). 1 day vs 2d. amendments: 2 (ADR-1758, ADR-1759) · reopened: n.

**Appetite burn:** 12 of 18 days (calendar, 2026-10-03..14; 67%). Both checkpoints fired late: day 7.5 (Phase 01 not
closed) and the day-12 tripwire (Phase 02 not closed). The scope-cut conversation was held as ADR-1762: nothing is cut,
because every cut-order item but REQ-08's second provider is already verified live. The overrun was the wait for owner
keys. Next checkpoint: 100% (day 18) → cut or kill, never extend.

## Now

**Current position:** Phases 00–03 closed; their `phase.closed` receipts are on the spine (2026-10-15). Phase 04's real
half is done except the owner's vetting stamp. On `arc-sandbox`, 32 slots are verified live and three are named ABSENT:
- `domain` and `payment-live`: behind their gates.
- `legal-pages`: the renderer is not ready.

Phase 04, live (2026-10-15):
1. **REQ-08 (neon).** The first vet was refused because the owner's only Neon org was Vercel-managed. With a key from
   his own org, the second was refused by Postgres 16 (`permission denied to set role "launch_anon"`). After the fix
   (the migration grants the role to its owner), it verified: receipt 01M4Y295RKMHSHBS52T7DE9Q08, owner 1 row,
   `launch_anon` 0. The run used a private state copy; arc-sandbox stays on Supabase. The fix is PR #432, which changes
   the adapter only; the row's `vetted` flip joins it after the stamp. A-06 never fired.
2. **`arc-harnesses` (ADR-1763, distribute REQ-15).** A new core wiring slot: `arc init` into the venture tree,
   verified by `arc doctor --dir`. Verified on the first real run: receipt 01M4YA96HKTWZNWSMYDQMCVKYS, 673 placed,
   0 missing, 0 unmanaged-conflict, four harnesses. The catalog now derives 86 slots / 34 core.
3. **REQ-05 and REQ-09.** The scout record holds 33 of 37 rows with digests that match their adapters. One
   approval.requested is on the spine for the owner: `01M4YAHP98TJ22E49S7WQGXAWE`, which supersedes `01M4Y85V…`.
4. **REQ-10.** The `launch-watch` row has been on main since PR #408. Its first run through `arc-jobs run launch-watch`
   (2026-10-15) exited 0: 4 public slots verified, 27 `skipped(env)`, 0 raised.
5. **The adapters changed by the attack fixes were re-applied.** The backup drill was re-written and ran green on
   venture CI. Receipts: backup 01M4YCVCREN06T9Y60SW17DBRJ, restore-drill 01M4YCWQXY50FKYAHPMGVTD4R5.

**Next step:** after the vetting stamp, every vetted row gets `status: vetted`, `vetted_by`, `scout` and `digest`.
Neon's flip goes in #432 and the rest in #425. Then Phase 05: `verify --all`, the evidence bundles, REQ-12 recorded as
OPEN-at-first-venture, `/arc-retro`. Owner ruling (2026-10-14): one merge, at the end of the cycle.

**Owed (gaps found live):**
- `release`: its state row carries the ERROR evidence of its first receipt, while its live verify answers READY.
  `apply --again` refuses a gated slot by design (gate-2), so re-receipting it needs a fresh gate-2 approval. That is a
  Cycle 2 path, not a v1 cut.
- `backup`: should provision its own pooler role and `SUPABASE_DB_URL` (done by hand on arc-sandbox).
- `secrets`: should place the runtime keys itself (done by the agent from the private env file).
- `security-headers`: should wait for the live build, as frontend does.

**Owner actions:**
- Stamp the provider vetting: `node .claude/scripts/hq/arc-inbox.mjs approve 01M4YAHP98TJ22E49S7WQGXAWE --reason ...`
  from the main clone.
- Stamp the phase-done approvals: 01 `01M4Y7WM3CBKFXKQNT3FP6QS1V`, 02 `01M4Y7WXRK37QY6QS6NKE26SAS`, 03
  `01M4Y7X28QG2WCQZXGQZ5ZFWHN`.
- Earlier stamps in arc-inbox: kickoff `01M40ZHP72PYVBJT17R7A4WZ3W`, owner rulings `01M41MH9JG9VEN5G085T56CNHH` and
  `01M41MHA25TV1WXYHHGM59ND5V`.
