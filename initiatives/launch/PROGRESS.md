# PROGRESS.md — launch Cycle 2 "the first real venture"

status: LIVE
cycle: arc-launch (Cycle 2, opened 2026-10-19)
phase: 06
appetite: 15d
burn: 0d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/launch/evidence/phase-NN/`.
Cycle 1 is archived under `archive/` (`PLAN-cycle1-2026-10-15.md` + `PROGRESS-cycle1-2026-10-15.md`); its phase specs
and evidence (`phase-00..05`) stay in place, because 33 vetting records point at them. ADR century 1700–1799;
ADR-1765..1769 written at kickoff.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 1 | — | ✅ 2026-10-04 |
| 06 | `@venture` hosts + `apply --next/--all`; live `frontend` on `myfitfolio` | 2.5d | ⬜ |
| 07 | `cloudflare-zone` + gate 1 + DNS chain live | 2d | ⬜ |
| 08 | Owed items + `arc-legal` vetting + money chain live (test mode) | 4d | ⬜ |
| 09 | Debt: D22, D29, D30, D32, D33, D40 + re-vet of changed adapters | 3d | ⬜ |
| 10 | Done line: core `verify --all` green from main + close | 1d | ⬜ |

## Done-log

- **Kickoff 2026-10-19** (kickoff.done `01M5AQ429SNNHNPFHBDT2YDCK8`; approved 2026-10-20). Tier M, 9 active REQs (REQ-13..21), 5 ADRs (1765-1769), owner forks: zone-verify for
  `domain`, `@venture` token, scope P1 + done-line Owed.

## Now

**Current position:** Cycle 2 kicked off 2026-10-19; plan approved 2026-10-20 (approval `01M5AQ42YSKTRYKK8G5XVZ0K3K`, decision `01M5AQ5BYS6WS342H4RPJRZC0T`). No code yet.
`myfitfolio` board: 5 verified · 1 failed (`frontend`, HOST_REFUSED) · 58 pending · 22 skipped.

**Next step:** after the approval, Phase 06: the red-first `launch-trust.bats` case for `@venture`, then the token in
`lib/ctx.mjs`.

**Owner acts named up front (pre-mortem #2):**
- Phase 06: approve this plan (it records the 19 rows' host scope change, ADR-1765).
- Phase 06 (before close): every key on the box, probed read-only (Cloudflare zone read, Resend, Supabase org, Razorpay test + webhook secret, Vercel env write, Sentry, PageSpeed); start the legal publish for `myfitfolio`.
- Phase 07: the `cloudflare-zone` vetting stamp and the
  gate-1 approval.
- Phase 08: vetting stamps for `arc-legal`, `secrets`, `backup`, `security-headers`, and the `passport` apply stamp.
- Phase 09: one re-vet stamp per adapter it changes.
- Phase 10: the close stamp.

**Appetite burn:** 0 of 15 days (2026-10-19 → 2026-11-02). Tripwire: day 7.5; Phase 07 not done → the scope-cut
conversation, with the cut order fixed in PLAN.
