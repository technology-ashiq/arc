# Arc → Money Engine — honest analysis & battle plan

> Written 2026-07-18, after reading the arc repo (PLAN.md, PROGRESS.md, README, CLAUDE.md,
> product-runbook, commands/agents/scripts inventory). This is a strategy doc, not a spec.
> Nothing here touches the repo until you say pannu.

---

## 1. What arc actually is today (facts, not hype)

- A **product factory**, not a product. 21 commands · 23 agents · ~30 scripts · 6 hooks,
  organized as 6 installable products (core / plan / review / qa / council / git) with
  manifests, a resolver, registry, selective install, 247 bats tests, 3-OS CI.
- Its real superpower is **trustable delegation**: kickoff → risk-ordered phases →
  Definition of Done → evidence bundles → adversarial gate testing → retro. "Evidence over
  assertion" is exactly the property you need before you let automation near money.
- The full idea→shipped→paid pipeline is already documented and partially armed:
  product-runbook covers Day 0 → Stripe checkout → deploy → canary → SEO content
  (seo-article-writer skill exists). Dogfood targets already named: venturemind, InvoiceFly.
- What arc is **not** (today): it has no runtime daemon (Claude Code is the runtime, ADR-scoped
  deliberately), no distribution/marketing muscle beyond one SEO skill, no revenue telemetry,
  no lead/outreach tooling, no content/video pipeline. Those are the gaps between
  "factory" and "money engine."

**Verdict in one line:** the BUILD problem is ~solved. Money is a DISTRIBUTION + OPERATIONS
problem, and that's what gets built next — as arc products, using arc's own method.

---

## 2. The honest frame: "automatic money" = automated company, human CEO

100% hands-off money does not exist (accounts/KYC/banking, platform trust, taste and
kill-decisions all need a human). What IS achievable, and what arc is unusually suited for:

> **A one-person holding company where 85–90% of execution is automated, and Ashiq's job is
> ~1–2 hrs/day: approve plans, review evidence, kill losers, talk to a few customers.**

Arc's gate culture is the unlock: every automated loop starts WARN-first (trial mode), earns
autonomy through the trial-ledger, and money-touching actions stay behind block-by-default
gates with explicit promotion. Same philosophy you already use for lint gates — applied to
business ops.

**Biggest risk (said with love):** factory-polishing addiction. Meta-work (re-homing,
byte-diff gates) is satisfying and measurable; revenue only comes from contact with
customers, which no gate can simulate. The mold is already better than 99% of what's out
there. Ship a paying thing next.

---

## 3. Scoring your 5 ideas (unmayana marks)

| # | Idea | Verdict | Why |
|---|------|---------|-----|
| 1 | Auto lead-gen → sell service | **8.5/10 — best first cash** | Money in weeks. Fulfillment is what arc automates best (audits, sites, automations as deliverables). Human closes the deal — that's fine. |
| 2 | Auto ideas → SaaS factory | **8/10 — the core engine** | Arc is literally built for this. But building is the cheap half; each product must ship WITH a distribution plan or it's a $0 portfolio. Expect 1 in 4 to live. |
| 3 | Auto trading | **2/10 as income · 5/10 as capped R&D** | Retail algo trading is negative-sum after costs; LLMs have no edge there; backtests lie (overfitting). If you must: paper-trade product, hard capital cap, kill criteria — AFTER real income exists. Never the plan. |
| 4 | Auto pain-point mining → products | **9/10 — build this first inside arc** | This is the missing front-end of the factory. Mining + council scoring turns "what to build" from vibes into evidence. Feeds idea #2 forever. |
| 5 | Faceless YT/IG/TikTok | **6/10 standalone · 8/10 as distribution arm** | Crowded, slow to ad-revenue (YT: 1k subs + 4k hrs), demonetization risk. But as the **marketing channel for your own products** it pays twice: traffic now, ad money later. You already have Higgsfield connected for generation. |

## 4. Ideas you didn't list (add these)

| Idea | Why it's solid |
|------|----------------|
| **Sell arc itself** (already your plan) | The meta-story is the marketing: "the factory that ships with receipts." Open-core repo → stars → sponsors → paid cloud dashboard/team features later. Every product you ship becomes an arc case study. |
| **"MVP in 7 days" productized dev service** | Fastest serious money. Fixed price ($1.5k–$5k), arc gives you 5–10× speed + evidence bundles as the client-facing trust artifact (show the receipts, close the deal). Case studies feed arc's launch. |
| **Vertical AI workers for SMBs** | InvoiceFly direction: invoice chasing, review replies, report generation. Boring niches, recurring revenue, high retention, low churn. One worker = one micro-SaaS. |
| **Boilerplate/template sales** | The Next.js+Supabase+Stripe skeleton arc products share, sold ShipFast-style ($99–$199). Near-zero marginal effort — it's a byproduct of the factory. |
| **Programmatic SEO sites** | seo-article-writer already exists. Comparison/tool/glossary sites in niches the pain-miner finds; affiliate + ads. Slow (3–9 months) but compounding and the most automatable of everything here. |

---

## 5. What to BUILD IN ARC (the new products)

Today's six products serve the factory. The money engine needs four more — each built via
`/arc-kickoff`, each WARN-first before autonomy:

### `discover` — the idea engine (build first)
- Scrapers/pollers: Reddit, HN, G2/Capterra reviews, app-store complaints → normalize.
- Clustering + scoring: frequency × willingness-to-pay × buildability-in-2-weeks × moat.
- `/arc-hunt <niche>` → shortlist → **council jury scores it** (jurors already exist!) →
  top candidate becomes a `/arc-kickoff` input. Evidence-based idea selection.

### `growth` — the distribution engine (build second)
- Content: expand seo-article-writer → programmatic SEO generator (`/arc-content <site>`),
  publish via git/CMS, internal-link graph.
- Video: script → TTS → assemble (ffmpeg/Remotion or Higgsfield) → auto-upload (YT API) →
  `/arc-video <product|topic>`. One pipeline, N channels, each channel tied to a product.
- Outreach: lead list builder + enrichment + personalized sequences (mail merge with real
  personalization, strict volume caps to protect domain reputation) → `/arc-leads <icp>`.

### `ops` — keep-it-running engine
- You have `/arc-canary`; add scheduled uptime/error polling, a support-inbox triage agent
  (draft replies, human send at first), weekly per-product health report auto-generated.

### `ledger` — the money brain
- Webhooks from payment provider → per-product MRR/revenue/churn in one dashboard (`/arc-pnl`).
- **Portfolio kill criteria** — apply appetite culture to products: e.g. "no paying user in
  60 days and <X organic visits → attic the product." The retro loop, pointed at money.

### Autonomy layer (the "automatic" part)
- Headless scheduled runs (GitHub Actions cron / scheduled tasks) driving arc commands:
  nightly content publish, weekly hunt digest, daily canary+ledger report.
- Promotion ladder, same as kickoff-lint: **draft-only → human-approve → auto with cap →
  auto**. Money-touching actions (pricing, refunds, ad spend, sending outreach) stay gated
  longest. This is arc's existing TRIAL→FAIL culture, reused as-is.

### Practical: payments from India
Stripe India is effectively closed/invite-only for new accounts; the standard indie route is a
**merchant-of-record** that handles global tax/compliance — Paddle, Dodo Payments, Creem
(Lemon Squeezy got acquired by Stripe; many moved off) — with Razorpay for domestic INR.
Verify current terms when the first product is at the payments phase; abstract it behind an
interface (offline-first rule already demands this).

---

## 6. Sequence — 90-day shape

**Weeks 1–2 · Finish the orchestrator initiative fast.** You're at ~10% appetite burn with
Phases 00–02 closed — momentum is great. Close 03–05 without gold-plating.

**Weeks 2–3 · Build `discover` v1** (one source — Reddit — is enough) and run the first
`/arc-hunt`. Council picks candidate #1.

**Weeks 3–6 · First money.** Two parallel small bets, no more:
1. **Ship one micro-SaaS** (InvoiceFly or the hunt winner) end-to-end THROUGH the runbook,
   including payments + 10 SEO pages + a launch (PH/HN/Reddit). Phase 04 dogfood and
   first-revenue become the same act.
2. **Offer the 7-day MVP service** in 2–3 places you already have credibility. One client
   pays for the quarter.

**Weeks 6–10 · Arc public launch.** Clean README + the story ("I built a factory; here's
product #1 with the receipts"). Sponsors on. Every later product ships as a build-in-public
case study — audience compounds.

**Weeks 10–13 · Build `growth` v1** (content first, video second, outreach third) and point
it at product #1 + the arc repo itself. Then the loop: hunt → build → launch → measure →
kill-or-scale → retro. Every cycle, automate one more step.

**Trading:** only after monthly income exists; paper-trading product with hard caps, treated
as R&D, never load-bearing.

---

## 7. Kill criteria for the whole vision (arc-style honesty)

- If after 2 full hunt→build→launch cycles (≈4 months) there is **zero revenue and zero
  audience growth** → the bottleneck is positioning/distribution, not the factory. Stop
  building, spend a cycle purely on audience (public launch, content, service clients).
- If the service gets traction but SaaS doesn't → lean service-first for 2 quarters; fund
  the portfolio from it. Cash flow buys patience.
- If any single automation consumes >2× its appetite before producing signal → attic it.
  Same rule you already live by.

**North-star metric for the money engine:** ₹/month of revenue per hour of Ashiq's weekly
involvement. Automation only "counts" when it moves that number.
