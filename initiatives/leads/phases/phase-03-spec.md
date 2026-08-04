# Phase 03 — Real campaign

**Goal (one line):** ≥25 real sends over ≥3 days to real ICP leads, every one L1-approved,
zero cap or suppression violations, honestly reported.
**Appetite:** 1.0 day (0.5d effort spread over ≥3 elapsed campaign days + 0.5d retro)
**Depends on:** phase-02

## STATUS: BLOCKED — this phase is not startable (ADR-0413)

This phase is **blocked, not deferred and not cut.** Its entry gate is *built* (see below);
its inputs are business and calendar physics that no code produces.

| # | Gate row | State at 2026-08-04 | Who unblocks it |
|---|---|---|---|
| 1 | A real offer, named | ✗ — blocked on LexOS billing (its P5, Sep '26 first-₹ target) | owner |
| 2 | Dedicated domain live + warmed ≥14d + DMARC green | ✗ — **2–4 calendar weeks. The long pole.** Start it the moment outbound is plausibly ≤6 weeks out | owner |
| 3 | ICP v0 file | ✗ — ~1 hour of owner business judgment | owner |
| 4 | Calendar link live + test-booked | ✗ — ~15 minutes | owner |
| 5 | Capability scout report → provider + verifier pick | ✗ — `/arc-capability`; ADR-0402's idempotency hard filter applies | `/arc-capability` |
| 6 | LEA-I / EVO-H0 ruling | ✔ **resolved** — ADR-0408 | done |

**Do not start this phase by relaxing a row.** The cascade rule exists because a kickoff that
builds ahead of the domain sends from a cold one to make a deadline. Rows 2–4 are
calendar-gated, not effort-gated: they should start weeks before this phase does.

## Exit criteria (Definition of Done)

- [ ] **All six gate rows above evidenced** — this is the entry condition, not an exit one
- [ ] **REQ-07 seed-inbox smoke passed, DATED ≤7 days old at campaign start**: ≥2 owned seed mailboxes (Gmail + Outlook-class), inbox placement verified (not spam), auth headers pass, unsubscribe end-to-end, reply + bounce ingestion fire on the seeds
- [ ] **ADR-0402 provider bound**: the real implementation satisfies the interface, and the same contract suite that ran against the fake in Phase 00 runs green against it
- [ ] **The campaign**: ≥25 sends over ≥3 days under the daily cap, every send L1-approved; exact daily distribution set when the phase starts
- [ ] Daily triage ritual run; SLA met per REQ-04
- [ ] `metric.observed` emitted per ADR-0408 — the kind, validator and grammar shipped in Phase 00's single vocabulary edit; **this phase is where the first real emission happens, and therefore where evolve's 4-week clock actually starts** — not at the Phase 0–2 merge
- [ ] **Campaign report, reader-derived and replay-identical**: researched · approved · submitted · reply rate = unique replying leads / **submitted** first touches · positive-reply rate · meetings · bounce rate · unsubscribes · cap/suppression blocks · HOLD events · zero violations
- [ ] **Qualitative retro doc (human-written, not derived)**: top objections · which personalization evidence actually earned replies · L1-stay recommendation — **written entirely in ADR-0410's opaque vocabulary: `lead_hmac`, `draft_ref`, provenance class, triage class. No lead or firm name, no domain, no quoted draft or reply text.** ADR-0410's tripwire matches email shapes and store paths, not names or prose, so this file is the one artifact in the lane its own guard cannot police
- [ ] tests green **on CI**; tracker updated

**REQ-05 acceptance explicitly is NOT a bounce threshold.** At n=25 one bounce is 4%, which
would fail a `<3%` criterion on a reviewed, resumable HOLD event. Acceptance is: zero
cap/suppression violations · zero spam complaints · no FREEZE fired · every HOLD reviewed and
resolved before further sends. Bounce rate is recorded and fed to the retro.

## What IS built while this phase is blocked

The **entry gate itself**, so that when the rows are evidenced the gate is already code and
refuses on failure regardless of what any evidence file claims:

- live DNS resolution of SPF/DKIM/DMARC (REQ-00, Phase 00)
- provider auth status through the interface (REQ-00, Phase 00)
- **dated** seed-evidence check: undated or >7 days → refused (REQ-07)
- Phase-3 entry without a seed smoke → refused (REQ-07)

## Verification plan

- **Test command:** refine at phase start via `/arc-change` — the entry-gate fixtures run in Phase 00/01 CI; the campaign's own verification is the report plus the retro.
- **Live demo scenario:** the campaign IS the demo. One real lead's journey end to end: researched with sealed evidence → a draft citing two true facts from that evidence → approved in the inbox → sent inside every cap from the warmed domain → the reply lands and the sequence stops itself → "interested" triage puts a calendar draft in the inbox within SLA → the meeting books, the receipt lands.
- **Real-system check:** the seed mailboxes, the provider dashboard, and the DMARC report — inspected by a human before lead send #1.
- **Expected evidence:** seed-smoke transcript with its date, **seed addresses rendered as `seed-1`/`seed-2` and never verbatim**; the reader-derived campaign report; the human retro doc (opaque refs only, per the exit criterion); `initiatives/leads/evidence/phase-03/manifest.json`. **The "one real lead's journey" demo is captured by `arc-leads report --journey LEAD_HMAC` from the reader — a raw terminal transcript of `arc-leads review` is PII and is never committed under `initiatives/leads/evidence/**`.**

## Rabbit holes in this phase

Deliverability scoring engines → **provider reports suffice** · chasing a bounce number at
n=25 → **ADR-0403's HOLD is the honest small-n response** · expanding the ICP mid-campaign →
**one ICP, v1**.

## Out of scope for this phase

Any autonomy promotion — that is ADR-0407's separate trial-ledger path, and it needs ≥2
campaigns. **The ADR-0407 promotion evaluator is built here or later, never in Phase 01** — it
has no possible input until campaign #2. A/B or self-optimizing logic — evolve owns experiments later.

## Your-setup / pending

**All six gate rows above.** Rows 2–4 are calendar-gated and should start now if outbound is
plausibly ≤6 weeks away. Row 2 (domain warm-up) is the critical path and cannot be compressed.

**If deliverability breaks mid-cycle** (DMARC regression, warm-up insufficient): the campaign
becomes an operational-runway milestone, the cycle banks Phases 0–2 on fixture evidence, and
the retro records the miss. **Never send from a cold or broken domain to make a deadline.**

## Non-negotiables (verbatim from PLAN)

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.
