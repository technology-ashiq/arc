# Arc HQ ("Jarvis") — architecture blueprint

> The second brain for business: a dashboard + autonomy layer that sits ABOVE arc,
> watches everything, asks for approvals, learns from outcomes, and gradually runs
> the company. Written 2026-07-18. Concept only — nothing gets implemented without
> explicit approval, and HQ itself gets built via /arc-kickoff like any product.

---

## 0. The one-line concept

**Arc = the factory. HQ = the company that owns the factory.**
Arc builds one product well. HQ decides *which* products exist, keeps them alive,
counts the money, and earns more autonomy every week it proves itself.

## 1. The position (respects arc's own ADRs)

Arc deliberately has **no runtime daemon** — "Claude Code remains the runtime."
Keep that. HQ is a **separate repo, a consumer of arc**, exactly like venturemind
or InvoiceFly:

```
                    ┌────────────────────────────┐
                    │  ARC HQ (new repo)         │
                    │  spine · brain · face      │
                    └─────┬────────────┬─────────┘
             schedules    │            │  renders / approves
        headless sessions ▼            ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │ product #1  │ │ product #2  │ │ channels    │   ← each an arc-installed repo
      │ (InvoiceFly)│ │ (GST-recon) │ │ (content/   │     or a process repo
      └──────┬──────┘ └──────┬──────┘ │  leads/…)   │
             │               │        └──────┬──────┘
             └───────────────┴───────────────┘
                     every action emits an EVENT → HQ spine
```

The heartbeat (cron/scheduler) lives in HQ. Arc repos stay pure. No arc ADR is
violated; HQ is just arc's biggest customer.

## 2. The five organs

### 2.1 The event spine — THE most important piece (and the cheapest)

The Jarvis everyone imagines is a UI. The Jarvis that works is a **data spine**.
Rule: *if it isn't an event, it didn't happen.*

- `arc-event.sh` (~30 lines, zero-dep): appends one JSON line to
  `events/YYYY-MM-DD.jsonl` and mirrors to HQ. Called from arc's existing hooks
  (SessionStart/End, PostToolUse) and commands (`/arc-phase-done`, `/arc-ship`,
  `/arc-council` …) — arc already has hook points at every lifecycle moment, so
  wiring is natural, not invasive.
- Event schema (v1, frozen small):

```json
{ "ts": "2026-07-18T09:12:33+05:30",
  "actor": "arc-phase-done | council | discover | human | stripe-webhook",
  "product": "invoicefly",
  "kind": "phase.closed | idea.captured | council.verdict | deploy.done |
           revenue.received | content.published | lead.replied | approval.granted |
           kill.executed | run.completed | cost.incurred",
  "payload": { },
  "evidence": "docs/evidence/phase-02/",
  "run_id": "r-2026-07-18-06",
  "cost": { "tokens": 184000, "inr": 92 },
  "autonomy": "L2" }
```

Everything downstream — dashboard, morning brief, learning, P&L — is a **view
over this log**. Arc already writes evidence bundles, session logs, ledgers;
the spine just normalizes them into one queryable stream.

### 2.2 State store + portfolio registry

SQLite (fits arc's zero-dep culture; Supabase later if HQ ever goes multi-device).
Tables:

- `ideas` — id, source, cluster, scores{pain,wtp,buildability,moat}, council_verdict, status
- `products` — id, repo, stage(idea→council→building→shipped→earning→attic), mrr, users, appetite, kill_criteria, kill_distance
- `runs` — id, type(discover|growth|ops|build), budget{tokens,inr,minutes}, spent, result
- `decisions` — id, ts, action, human_verdict, reason  ← every approve/reject, mined later
- `experiments` — id, hypothesis, metric, result, verdict ← marketing/pricing as science
- `metrics` — ts, product, key, value (mrr, visits, subs, conversion…)

This is `arc-registry.json` thinking, promoted from "what's installed" to
"what does the company own and how is it doing."

### 2.3 The heartbeat — scheduler with budgets

Cron (GitHub Actions / Task Scheduler / tiny node loop) that starts **headless
Claude Code sessions** running arc commands, each with an arc-style appetite:

`{ job: discover.nightly, cmd: "/arc-hunt fintech-smb", budget: {inr: 150, minutes: 40}, autonomy: L2 }`

Budget exhausted → run stops and reports, never silently continues. Compute
gets the same appetite discipline as build phases.

### 2.4 The policy engine — autonomy ladder + approval inbox

"Automatic" is not a switch — it's a ladder each process **climbs by evidence**
(arc's TRIAL→FAIL culture, generalized to the whole company):

| Level | Meaning | Example |
|---|---|---|
| **L0** | observe/log only | trading with real money (starts here, stays here long) |
| **L1** | draft → human approves each | outreach copy, kickoffs, pricing |
| **L2** | act within hard caps, notify | content publish, deploys (arc gates already cover), outreach ≤20/day |
| **L3** | act freely, weekly digest | SEO articles after 60 clean days |
| **L4** | act + adjust own caps | almost nothing, maybe never |

- **Promotion needs trial-ledger evidence** — e.g. `content.draft L1→L2` after 20
  consecutive drafts approved unedited. Demotion is automatic on any incident.
- **Money-touching actions (pricing, refunds, ad spend, real trades) cap at L1–L2
  indefinitely.** That's not a limitation of the vision — it IS the vision;
  trust-with-receipts is the brand.
- **Approval inbox** = the human interface. Morning: 5 scored ideas, 2 approvals,
  1 kill recommendation. Every tap becomes a `decisions` row — training data for
  calibration.

### 2.5 The face — dashboard + chat

- **Dashboard v1: read-only.** Renders the spine: Today feed · Pipeline kanban ·
  Portfolio cards · Money strip · Approvals · Learning panel. Local Next.js (or
  even static HTML + tiny API) reading SQLite. See the mock: `arc-hq-mockup.html`.
- **Chat = Claude wired to an HQ MCP server** (`hq_query`, `hq_approve`,
  `hq_brief`). "Jarvis, why did revenue dip Tuesday?" is a query over the spine,
  not magic. The dashboard shows; the conversation reasons.

## 3. The learning loop — "konjam konjama learn"

Learning here ≠ model training. It's **calibration + rule accretion**, and arc
already owns the seeds:

1. **Council calibration** — `council-calibrate.mjs` EXISTS. Close the loop:
   council predicts ("this idea reaches ₹X MRR in 90d, confidence 0.7") → reality
   lands in `metrics` → juror hit-rates update → vote weights shift. The 30th
   idea decision is measurably better than the 1st. **This is the flywheel.**
2. **Retro rule accretion** — `/arc-retro` already turns repeated corrections into
   permanent rules. Extend beyond code: launch retro, pricing retro, content
   retro → `playbooks/*.md`. The company's genome, growing weekly.
3. **Experiment ledger** — every growth action is hypothesis → metric → verdict.
   A year of this = proprietary market knowledge no one can prompt into existence.
4. **Decision memory** — his approve/reject/kill patterns teach HQ his taste;
   the inbox slowly pre-sorts itself.

## 4. A day in the life (the target rhythm)

```
06:00  discover run      scrape → dedupe → 5 candidates scored (L2, budget-capped)
07:00  council session   top 2 judged → 1 PROCEED (conf 0.78) → inbox
08:00  growth run        yesterday's metrics read → today's content drafted/queued
08:30  ops run           canary all products · support inbox triaged → 2 drafts
09:00  ledger run        revenue events ingested → morning brief compiled
09:15  ASHIQ (30 min)    read brief · approve kickoff · reject 1 idea · confirm 1 kill
10:00+ build sessions    approved phases execute (interactive where creative,
                         headless where mechanical) — arc gates unchanged
14:00  sale.received     webhook → spine → dashboard ticks
21:00  evening digest    what shipped, what earned, what failed
21:10  retro delta       2 rules added · 1 juror reweighted · 1 promotion proposed
```

One day = fully replayable from the spine. "Oru naal la arc panna ellame
dashboard la" — literally, because everything IS an event.

## 5. Build order (arc-style appetites — and one hard rule)

**Hard rule: the first revenue product ships IN PARALLEL. HQ observes the
business; it must never postpone the business.** HQ is a product: it gets a
PLAN.md, phases, kill criteria, and its own appetite.

| # | Piece | Appetite | Note |
|---|---|---|---|
| 0 | `arc-event.sh` + hook/command wiring | 2–3 days | the foundation; do first |
| 1 | HQ repo: ingest + SQLite + **morning brief CLI** | 1 week | brief before UI — value on day 3 |
| 2 | Dashboard v1 (read-only, per the mock) | 1 week | renders spine; zero write paths |
| 3 | Approval inbox + autonomy config (`hq.policy.yaml`) | 1 week | L-levels per action kind |
| 4 | Scheduler + first headless job (discover nightly) | 3–4 days | budgets enforced |
| 5 | `discover` product v1 (one source: Reddit) | 1–1.5 weeks | feeds the loop |
| 6 | Calibration wiring (council ↔ outcomes) | 3–4 days | extends council-calibrate.mjs |
| 7 | `growth` v1 → `leads` v1 → `ops` v1 | 1 week each | promote autonomy by evidence |
| 8 | `trader` sandbox (paper-only, L0/L1) | last | never load-bearing income |

~6–8 weeks part-time to a living HQ v1 — while product #1 earns its first money.

## 6. The moat — "AI evolution aanalum kastma irukanum"

Honest: **the code is not the moat.** Any strong model can eventually clone the
mechanism. What can't be cloned:

1. **The spine's history** — years of events, outcomes, costs. Proprietary by
   construction.
2. **Calibration tuned on real results** — juror weights that reflect *your*
   markets' reality. Cannot be prompted into existence; only earned.
3. **Retro-accumulated playbooks** — thousands of hard-won rules from real
   launches and real failures.
4. **Distribution assets** — aged domains, subscribed channels, email lists,
   platform reputation, existing paying users. AI cannot fake account age or
   audience trust.
5. **Taste** — the decision memory encodes Ashiq's judgment; the system becomes
   personal, not generic.

And the beautiful inversion: **model upgrades are tailwind, not threat.** Every
better model slots into the same machine and makes it stronger — while the data
moat keeps compounding. Competitors get the same better models, but start at
zero events, zero calibration, zero audience. The race is not "who has AI";
it's "whose AI has been keeping receipts the longest."

## 7. Anti-slop guards (kill criteria for HQ itself)

- If HQ v1 (rows 0–4) isn't producing a daily brief within **3 weeks** → scope
  cut to event log + brief only; dashboard waits.
- If any week has HQ-building hours > product/revenue hours **twice in a row** →
  freeze HQ features until a product ships something.
- If an autonomy promotion causes an incident → auto-demote one level; promotion
  re-earned via the trial ledger, never by feeling.
- North-star (unchanged): **₹/month revenue per hour of Ashiq's weekly
  involvement.** Every HQ feature must argue how it moves that number.
