# PROGRESS.md — launch v1 "the venture factory"

status: IDLE
cycle: arc-launch (Cycle 1, opened 2026-10-03)
phase: 05 (cycle closed)
appetite: 18d
burn: 13d
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
| 04 | Recommendation + REQ-08 + trust runtime + wiring + drift + teardown | 2d | ✅ 2026-10-15 |
| 05 | Close | 1d | ✅ 2026-10-15 |

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
- **Phase 04 ✅ 2026-10-15** — REQ-08, REQ-09, REQ-10 validated.
  - REQ-08: `plan` derives every pick with its fit-rule ids or prints REFUSED. `neon` verified live on the owner's own
    org (receipt 01M4Y295RKMHSHBS52T7DE9Q08, owner 1 row, `launch_anon` 0) and is vetted in PR #432, whose file list
    is its row and its adapter only.
  - REQ-09: the trust fixtures run on CI against every real adapter (`trust-all`). The vetting stamp
    (decision.recorded 01M4YYNSS3H8N5A5HWAG77BM3J) pinned 33 digests, each recomputed at the flip.
  - REQ-10: passport, ledger-source, face-room and teardown-plan verified; the `launch-watch` job's first run exited 0.
  - `arc-harnesses` (ADR-1763, distribute REQ-15) verified on its first real run: 673 placed, 0 missing.
  CI on #425 green per job (run 38675000566). 2 days vs 2d (the real half; the fakes half shipped in #404).
  amendments: 2 (ADR-1763, ADR-1764) · reopened: n.
- **Phase 05 ✅ 2026-10-15 — Cycle 1 closed.** REQ-05 and REQ-12 validated.
  - REQ-05, met with two named exceptions (ADR-1764): from the main clone after the merge (#425 → `ca72f1f9`, with
    neon's #432 squashed into it as `ff11d142`), `verify --all` is 32/32, exit 0. The first main run read 31/32
    because Mozilla Observatory answered 500 for `security-headers`; the slot passed on retry and the whole run was
    repeated. The board is 34/34 core verified or a named ABSENT. `launch-coverage` reads 33 vetted and 2/34 core
    slots with zero vetted providers, exactly `domain` and `legal-pages`.
  - REQ-12: recorded **OPEN-at-first-venture**. No `revenue.received` exists for a launch-scaffolded venture; the
    rehearsal's money is `revenue.simulated` and nets to 0.
  - Retro done on #425 (5 lessons, scoreboard row, HISTORY C27). Bundles 01–05 written and verified.
  - Found at the merge: the lint self-test's baseline copied the registry without the adapters, so every vetted
    row made it refuse before testing a mutant. Fixed on #425 (`b1003d1a`).
  CI per job on #425's merged head: run 38715698472, 19/19 success; 268 launch tests. 0 days vs 1d.
  amendments: 0 · reopened: n.

**Appetite burn:** 13 of 18 days (calendar, 2026-10-03..15; 72%). Both checkpoints fired late: day 7.5 (Phase 01 not
closed) and the day-12 tripwire (Phase 02 not closed). The scope-cut conversation was held as ADR-1762: nothing is cut,
because every cut-order item but REQ-08's second provider is already verified live. The overrun was the wait for owner
keys. Next checkpoint: 100% (day 18) → cut or kill, never extend.

## Now

**Current position:** Cycle 1 closed 2026-10-15, 6/6 phases. The lane is IDLE. `arc-sandbox` answers on
`sandbox.automemory.ai` with 32 slots verified live, and 33 providers are vetted. Spine: phase.closed 05
`01M4ZJSW064ENA1YAJGHEEMC6Z`.

**Next step:** Cycle 2, through `/arc-kickoff --lane launch`, when the owner opens it. It carries:
- the Owed list below;
- the two named exceptions of ADR-1764;
- REQ-12, which a first real venture answers.

Distribute is sent the #425 merge SHA `ca72f1f9` for its REQ-15.

**Owed (gaps found live):**
- `release`: its state row carries the ERROR evidence of its first receipt, while its live verify answers READY.
  `apply --again` refuses a gated slot by design (gate-2), so re-receipting it needs a fresh gate-2 approval. That is a
  Cycle 2 path, not a v1 cut.
- `backup`: should provision its own pooler role and `SUPABASE_DB_URL` (done by hand on arc-sandbox).
- `secrets`: should place the runtime keys itself (done by the agent from the private env file).
- `security-headers`: should wait for the live build, as frontend does.

**Owner actions:**
- Stamp the Phase 05 approval `01M4ZJSZ3M1NT2BA6QJ2FEJKMP` (`arc-inbox approve <id> --reason ...` from the main clone).
