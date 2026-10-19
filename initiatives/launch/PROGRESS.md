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

**Current position:** Phase 06 code MERGED 2026-10-20: PR #443 → `0bbe7dc8` (head `89520c47`, CI run 39321893373
19/19 green). `@venture` hosts (REQ-13) and `apply --next/--all` (REQ-14) are on main; attack r1 (74ba8f0) + r2
(9d10382) fixed, L4 → debt D46. Live, from the main clone: the owner's `apply frontend --venture myfitfolio` answered
`failed (verify: https://myfitfolio.com/ answered 525, not 200)`, receipt `01M5B0PVX6H2KG8FNV7GGYGMR4`. That is
past HOST_REFUSED: the adapter now reaches the venture's domain.

**A-15 FIRED (2026-10-20):** the apex is proxied (orange cloud, A `104.21.1.99` / `172.67.129.3`), so Cloudflare's edge
fails the TLS handshake to Vercel (525); `myfitfolio.vercel.app` answers 200. Per the ledger, REQ-13's live clause moves
to Phase 07 after `dns`, and Phase 06 closes on fixtures + the ctx resolution proof. Phase 07 catch: `cloudflare-dns`
refuses the owner's existing apex records as `FOREIGN_RECORD` (`cloudflare-dns.mjs:89-91`), so the owner deletes them
before `dns` runs.

**Next step:** Phase 06 close on branch `feat/launch-p06-close` (this file + `evidence/phase-06/live-runs.md`): open its
PR, run the 7 read-only key probes (phase-06 spec "Key probes"), the `plan` prefix + `apply --all` walk transcript,
the legal `propose --dry-run` (A-12), then `/arc-phase-done 06 --lane launch`. Then Phase 07 (`cloudflare-zone`).

**Still owed from the Phase 06 DoD:** key probes · legal dry-run · day-1 `required_when` count (34 expected) + the
`verify --all` pair · the `apply --all` live transcript · two-surface attack evidence is in place.

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
