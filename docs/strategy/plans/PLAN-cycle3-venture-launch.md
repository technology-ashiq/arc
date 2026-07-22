# PLAN (design source) — Cycle 3 · First Money: [VENTURE] launch

> **Trigger:** Cycle 2 (receipt spine) closed, or running late — first money must not wait
> past ~2 weeks after it. **Prerequisite decision:** VENTURE named (see "Venture slot").
> This kickoff runs **in the venture's repo** (arc installed there), not in the mold.
> arc-side work is FROZEN during this cycle except retro fixes.

## Venture slot — decide before kickoff (candidates as of 2026-07-22)

**InvoiceFly does not exist** (never created — ADR-0022 in the arc repo). Real options:

1. **Productize Opportunity-Scout** — existing real repo, fresh arc install (council).
   If its function is opportunity/pain scanning, it doubles as discover's precursor and
   the venture IS the money-engine front-end. Strong default IF its core loop is near-usable.
2. **venturemind** — existing repo, arc core+plan installed (upgrade-path consumer), a real
   kickoff already ran in it. Choose if its product thesis is closer to paying users.
3. **New venture from a hunt** — only if 1 and 2 both fail the test below; requires
   discover v1 first (costs ~1.5w — accept the delay consciously).

**The 10-minute test to decide:** for each candidate answer — Who pays? What painful task
does it kill? Can a stranger get value in <10 minutes? Can it charge money within 3 weeks?
Pick the one with the most concrete answers. Record the choice as an ADR in the venture repo.

## Goal

One sentence: [VENTURE] goes from working-core to **launched product with live payments,
real distribution assets, and its first real `revenue.received` event** — inside a 3-week
hard cap, with the pivot rule armed so silence produces a positioning cycle, not more features.

## Current state (fill at kickoff from the venture repo)

- Core loop status: TODO · Stack: TODO (runbook default: Next.js + Supabase + Vercel)
- arc install: confirmed (registry) · spine: emit venture events if Cycle 2 shipped
- Payments: none · Domain/landing: TODO · Analytics: none · Content: none

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | Anyone can pay | Payment rail live via MoR/gateway: test-mode e2e buy green, live-mode smoke buy + refund executed and evidenced; webhook/export → `revenue.received` ingest (spine if available, else provider dashboard screenshot in evidence) | 0–1 |
| REQ-02 | Pricing exists and is honest | One paid tier, one price, entitlement gating enforced in code (free limit → pro unlock verified in the real DB); no pricing experiments before customer #10 | 1 |
| REQ-03 | The product can be found | 10–12 SEO pages live (keyword list mined from real complaint language), sitemap+robots+OG correct, landing scores ≥8 via /arc-design review | 2 |
| REQ-04 | Launch actually happened | 5 channels executed, one per day (PH · HN Show · 2 niche communities · IH · build-in-public thread), each with the post URL in evidence; /arc-canary watching prod during launch week | 3 |
| REQ-05 | We can see the funnel | Privacy-light analytics live: visits → signup → activation → pay counts readable for launch week; baseline recorded in the retro | 3–4 |
| REQ-06 | First real money OR an honest verdict | ≥1 real paying customer (`revenue.received`, real only) — OR the pivot review runs with the funnel numbers and produces a written positioning decision. Both outcomes close the REQ; only one of them is a party | 4 |

## Appetite

**3 weeks hard cap.** Tier: M.
**Kill/pivot criteria:** launch week done + <500 unique visits or 0 signups → **STOP
building features**; one positioning/channel cycle before any new build. Payments blocked
>1 week on provider KYC → switch provider (the ADR lists the fallback order). At 100%
appetite → ship what's live, retro, decide.

## Key decisions to ADR (in the venture repo, at kickoff)

| ID | Decision |
|---|---|
| V-A | Payment rail: compare **Paddle vs Dodo Payments vs Creem** (merchant-of-record, global tax handled) + **Razorpay** (domestic INR). Criteria: KYC lead time for an Indian individual/sole-prop, fees, payout schedule, subscription support, API quality. Decide in ONE evening; record fallback order. Verify current signup terms live — landscape shifts |
| V-B | Pricing v1: one tier, one price (anchor from 3 comparable products; when in doubt, higher + refund promise) |
| V-C | Free/pro gate: the ONE limit that creates upgrade pressure without killing first-run value |
| V-D | Launch positioning: the one-sentence "for WHO, kills WHAT pain" — written before any launch copy |

## Non-negotiables

- Offline-first inherited: payment provider behind an interface (fake impl for tests, real
  impl live) — provider swap must not touch business logic.
- Live-mode verification is real: one real card buy + one real refund, evidenced (runbook
  Stage 5/7 as written). Verify in the real place (DB entitlement flip), not in logs.
- `revenue.received` = real money only; test/simulated payments never enter it.
- Every phase closes via /arc-phase-done with evidence; /arc-review before ship days.
- No secrets in repo; provider keys in .env.local only.
- Launch posts are honest and personal — no fake traction claims, no bot engagement
  (Constitution E3; reputation is a launch asset for every future venture).
- Feature freeze during launch week: bugs yes, features no (/arc-change queues them).

## No-gos

- No second tier, no annual/monthly matrix, no coupons v1 · no A/B tests before customer #10.
- No paid ads this cycle · no affiliate program · no multi-language.
- No arc-side module building (growth/leads/etc. wait for their pull-triggers).
- No custom billing portal (provider-hosted only) · no invoicing features beyond the provider's.

## Rabbit holes

Payment-provider feature tourism (V-A is one evening, timeboxed) · landing-page perfection
(ship at design-score 8, not 10) · SEO expecting instant traffic (it compounds later —
launch channels carry week-1) · analytics dashboard building (counts, not dashboards) ·
"one more feature before launch" (the pivot rule exists because features don't fix positioning).

## Assumptions ledger

| Assumption | Trigger it's wrong | Phase |
|---|---|---|
| Venture core loop is genuinely usable by a stranger | first 3 outside testers can't reach value in 10 min → fix onboarding BEFORE payments phase continues | 0 |
| MoR account approval ≤1 week for Indian individual | KYC stalls >1 week → fallback provider (V-A order) | 0–1 |
| Launch channels allow the post (karma/rules) | a channel blocks → swap from the reserve list (r/SideProject, HN Show rules check, LinkedIn) | 3 |
| Provider webhook/export reachable without a server | push-only webhook needed → provider dashboard export + manual ingest until later | 1 |

## Pre-mortem (top 5)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | **Launch silence** (the most likely failure) | Pivot rule armed in kill criteria; positioning ADR (V-D) written BEFORE copy; build-in-public thread warms audience from day 1 |
| 2 | KYC/payments stall eats the appetite | V-A decided evening-1, application submitted day-1 of Phase 0; fallback order pre-agreed |
| 3 | Feature creep disguised as launch prep | Feature freeze non-negotiable + /arc-change queue |
| 4 | Traffic arrives, activation fails | REQ-05 funnel counts + 3-stranger usability check in Phase 0 |
| 5 | Refund/dispute mess post-launch | MoR handles tax/compliance; refund promise honored same-day; refund flow tested in REQ-01 |

## Phases (risk-ordered)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | Walking skeleton to money: V-A ADR + provider application day-1 · payment interface + fake impl · test-mode checkout e2e · 3-stranger usability check on the core loop | 4d |
| 1 | Real payments: live keys · entitlement gating (REQ-02) · live smoke buy + refund · revenue ingest wired | 3d |
| 2 | Distribution assets: 10–12 SEO pages · landing polish to ≥8 · OG/social cards · docs/FAQ · analytics counts | 4d |
| 3 | Launch week: one channel per day × 5 · canary watch · support triage (manual, drafts OK) · daily funnel reading | 5d |
| 4 | Verdict: funnel baseline recorded · REQ-06 outcome (party or pivot decision) · /arc-retro · learnings → playbook | 2d |

**North-star:** first real `revenue.received` — and if not, an honest written positioning
decision instead of a quiet slide into more building.

---

## KICKOFF PROMPT — paste into Claude Code in the VENTURE repo

```
/arc-kickoff [VENTURE] launch — first money

Design source: <path-to-arc>/docs/strategy/plans/PLAN-cycle3-venture-launch.md (approved).
Read it fully. Fill the venture slot + "Current state" from THIS repo's reality first and
show me. Decisions V-A..V-D are mine — prepare the comparison for V-A (Paddle vs Dodo vs
Creem vs Razorpay for an Indian solo founder, current signup terms verified via web) and
ask me to decide the four ADRs before Phase 0 code.
- REQs, appetites, no-gos, pivot rule are locked from the design source.
- Feature freeze during launch week is a non-negotiable in the plan you write.
- STOP after PLAN.md + phase specs + the V-A comparison — I approve before any code.
```
