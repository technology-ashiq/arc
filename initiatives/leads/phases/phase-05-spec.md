# Phase 05 — Real campaign

**Goal (one line):** ≥25 real sends over ≥3 days to real ICP leads, every one L1-approved,
zero cap or suppression violations, honestly reported.
**Appetite:** 1.0 day (0.5d effort spread over ≥3 elapsed campaign days + 0.5d retro) —
**PARKED to the next cycle 2026-08-08**, so this day does not count against Cycle 8's 7
**Depends on:** phase-03

## STATUS: BLOCKED and PARKED — this phase is not startable (ADR-0413)

This phase is **blocked, not deferred and not cut**, and as of 2026-08-08 it is **parked to the
next cycle** so its appetite does not sit against a cycle that cannot spend it. Its entry gate
is *built*; its inputs are business and calendar physics that no code produces.

It carries the half of the old Phase 03 that five known recipients cannot test: whether the
offer lands, what the reply rate is, how the domain behaves under cold conditions, and what
bounces and complaints do. Phase 03 now proves the machine. **This phase is the only thing that
can prove the business result**, and nothing in Phases 03 or 04 may be read as having done so.

| # | Gate row | State at 2026-08-08 | Who unblocks it |
|---|---|---|---|
| 1 | A real offer, named | ✗ **NOT THIS QUARTER** — owner confirmed 2026-08-08 he cannot name the 25 recipients, which is what an undefined offer looks like from the inside | owner |
| 2 | Dedicated cold domain live + warmed ≥14d + DMARC green | ✗ **NOT THIS QUARTER** — **2–4 calendar weeks, the long pole.** `automemory.ai` can never serve this row: it is the product domain (ADR-0402), and rehearsal mode (ADR-0416) does not extend to cold sends | owner |
| 3 | ICP v0 file | ✗ **NOT THIS QUARTER** — derives from row 1 | owner |
| 4 | Calendar link live + test-booked | ✗ **NOT THIS QUARTER** — ~15 minutes, but pointless before rows 1–3 | owner |
| 5 | Capability scout report → **cold-outbound** provider + verifier pick | ✗ — `/arc-capability`. **Resend does not serve this row**: transactional providers forbid unsolicited mail in their terms, so the rehearsal vendor is not a candidate here | `/arc-capability` |
| 6 | LEA-I / EVO-H0 ruling | ✔ **resolved** — ADR-0408 | done |

**The re-open trigger, written down so it is a trigger and not a hope: the day row 1 lands —
an offer is named — this table is re-opened and row 2 starts that same week**, because from
that day the 2–4 week warm-up is the longest thing standing between here and a first send.

**Do not start this phase by relaxing a row.** The cascade rule exists because a kickoff that
builds ahead of the domain sends from a cold one to make a deadline.

## Exit criteria (Definition of Done)

- [ ] **All six gate rows above evidenced** — this is the entry condition, not an exit one
- [ ] **REQ-07 seed-inbox smoke re-run and DATED ≤7 days old at campaign start** — Phase 03's
      run will be months stale by then and a stale smoke is exactly what the dating rule exists
      to refuse
- [ ] **ADR-0402 cold-outbound provider bound**: a real implementation satisfying the interface,
      and the same contract suite that ran against the fake in Phase 00 and against Resend in
      Phase 03 runs green against it. **Any fixture the rehearsal validated against Resend is
      re-validated here** — a rehearsal vendor's behaviour is not a cold vendor's behaviour
- [ ] **The campaign**: ≥25 sends over ≥3 days under the daily cap, every send L1-approved
- [ ] Daily triage ritual run; SLA met per REQ-04. **This is also where the "~15 min/day of
      inbox ritual is sustainable" assumption finally gets tested** — five recipients over one
      run never could
- [ ] `metric.observed` emitted per ADR-0408 — **this phase is where the first real emission
      happens, and therefore where evolve's 4-week clock actually starts**
- [ ] **Campaign report, reader-derived and replay-identical**: researched · approved ·
      submitted · reply rate = unique replying leads / **submitted** first touches ·
      positive-reply rate · meetings · bounce rate · unsubscribes · cap/suppression blocks ·
      HOLD events · zero violations. **Rehearsal-marked receipts are excluded and the report
      states the exclusion count** — a silent exclusion and a silent inclusion look identical
- [ ] **Qualitative retro doc (human-written, not derived)**: top objections · which
      personalization evidence actually earned replies · L1-stay recommendation — **written
      entirely in ADR-0410's opaque vocabulary**: `lead_hmac`, `draft_ref`, provenance class,
      triage class. No lead or firm name, no domain, no quoted draft or reply text. ADR-0410's
      tripwire matches email shapes and store paths, not names or prose, so this file is the one
      artifact in the lane its own guard cannot police
- [ ] tests green **on CI**; tracker updated

**REQ-05 acceptance explicitly is NOT a bounce threshold.** At n=25 one bounce is 4%, which
would fail a `<3%` criterion on a reviewed, resumable HOLD event. Acceptance is: zero
cap/suppression violations · zero spam complaints · no FREEZE fired · every HOLD reviewed and
resolved before further sends. Bounce rate is recorded and fed to the retro.

## Verification plan

- **Test command:** refine at phase start via `/arc-change` — the entry-gate fixtures run in
  Phase 00/01/03 CI; the campaign's own verification is the report plus the retro.
- **Live demo scenario:** the campaign IS the demo. One real lead's journey end to end:
  researched with sealed evidence → a draft citing two true facts from that evidence → approved
  in the inbox → sent inside every cap from the warmed dedicated domain → the reply lands and
  the sequence stops itself → "interested" triage puts a calendar draft in the inbox within SLA
  → the meeting books, the receipt lands.
- **Real-system check:** the seed mailboxes, the provider dashboard, and the DMARC report —
  inspected by a human before lead send #1.
- **Expected evidence:** seed-smoke transcript with its date, **seed addresses rendered as
  `seed-1`/`seed-2` and never verbatim**; the reader-derived campaign report; the human retro
  doc (opaque refs only); `initiatives/leads/evidence/phase-05/manifest.json`. **The "one real
  lead's journey" demo is captured by `arc-leads report --journey LEAD_HMAC` from the reader —
  a raw terminal transcript of `arc-leads review` is PII and is never committed under
  `initiatives/leads/evidence/**`.**

## Rabbit holes in this phase

Deliverability scoring engines → **provider reports suffice** · chasing a bounce number at
n=25 → **ADR-0403's HOLD is the honest small-n response** · expanding the ICP mid-campaign →
**one ICP, v1** · assuming a fixture is proven because the rehearsal was green → **it was
proven against a different vendor**.

## Out of scope for this phase

Any autonomy promotion — that is ADR-0407's separate trial-ledger path, and it needs ≥2
campaigns. **The ADR-0407 promotion evaluator is built here or later, never earlier** — it has
no possible input until campaign #2. A/B or self-optimizing logic — evolve owns experiments
later.

## Your-setup / pending

**All six gate rows above.** Rows 2–4 are calendar-gated and start the week row 1 lands. Row 2
(dedicated cold domain + warm-up) is the critical path and cannot be compressed.

**If deliverability breaks mid-cycle** (DMARC regression, warm-up insufficient): the campaign
becomes an operational-runway milestone, the cycle banks what it has, and the retro records the
miss. **Never send from a cold or broken domain to make a deadline.**

## Non-negotiables (verbatim from PLAN)

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- The product domain reaches only people on an env-declared allowlist, refused in code before any network call, never by policy text: arc's own notification mail is owner-directed (ADR-0415), and the outreach path may bind the product domain ONLY in ADR-0416 rehearsal mode, allowlist-locked and receipt-marked. Real cold outbound always requires the dedicated domain (ADR-0402). Real, simulated and rehearsal sends are three classes and are never mixed in any count.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.
