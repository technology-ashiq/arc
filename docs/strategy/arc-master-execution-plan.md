# arc — Master Execution Plan v1.1

> 2026-07-18. The consolidated, worked-out plan: from today's repo state to a
> receipt-driven, mostly-automated, money-generating company. Supersedes nothing —
> it SEQUENCES everything already decided (architecture v2.1, Cycle-2 PLAN v2, money
> analysis). Dates are planning aids; **appetites and gates are the real control.**
> Nothing touches the repo without explicit approval per cycle.
> v1.1: coverage audit vs the full conversation — added `memory` + `chat/MCP` rows to
> §6, video pipeline named in growth's scope, byproduct-revenue rule in §7, and the
> coverage map (Appendix D) proving where every discussed idea lives.

---

## 0. Mission (locked)

> **arc is a receipt-driven company operating system: one event spine, one process
> layer, one model router, one human approval inbox.**
> Kernel runs the company · workflows do the work · ventures make the money ·
> every claim has a receipt.

North-star: **₹/month of revenue per hour of Ashiq's weekly involvement.**
Five laws: process over model · if it isn't an event it didn't happen · trust is earned
by evidence · everything measured, everything improvable · boring tech, receipts everywhere.
Above all of it sits the **arc Constitution** (decision log #14; draft pending adoption) —
the five laws graduate into its articles; every future decision passes it first.

## 1. Where we are today (2026-07-18)

- Cycle 1 (orchestrator monorepo): Phases 00–02 ✅ closed (~1 session each, way under
  appetite). Phase 03 re-homing in progress (ckpt 0 hardened ✅, ckpt 1 council ✅;
  next: core → plan → review → qa+git). Phases 04–05 pending. Burn ~10%.
- 6 modules live (core/plan/review/qa/council/git), 247 bats green, 3-OS CI.
- Dogfood targets named: venturemind + InvoiceFly (Phase 04).
- Cycle-2 PLAN v2 drafted & twice-reviewed (receipt spine — 9 REQs, ADRs 0021–0028).
- Nothing of Cycle 2+ exists in code. All strategy docs are chat deliverables only.

## 2. Roadmap at a glance

| Cycle | Window (aid) | OS deliverable | Venture/money deliverable | Gate to next |
|---|---|---|---|---|
| **1 · close-out** | now → ~Jul 31 | Phases 03–05 done: re-homing behind byte-diff, dogfood installs, prune/attic, retro | Dogfood targets confirmed live (venturemind / InvoiceFly) | `/arc-retro` + Ashiq OK on Cycle-2 kickoff |
| **2 · Receipt Spine** | ~Aug 1 → Aug 22 (2.5w cap) | Spine + reader + brief + inbox live; ADRs 0021–0028; twin determinism in CI | Venture #1 build days run ON the spine (Phase 4 dogfood = its real build) | REQ-07 evidence bundle + retro |
| **3 · First Money** | ~Aug 24 → Sep 18 (3w cap) | OS: only retro fixes — feature freeze | **Venture #1 launched with payments: first REAL `revenue.received`** | ≥1 paying customer OR pivot review |
| **4 · Second Engine** | ~Sep 21 → Oct (3w cap) | Pulled by gate-3 outcome: growth v1 (traction) or discover v1 (need new bet); engine v1 (3 drivers) if arc-public prep starts | Content/SEO pointed at venture #1; venture #2 candidate scored | Traction review |
| **5 · Public arc** | ~Nov | arc public repo launch (README/story/receipts); engine v1 done; sponsors on | Launch content = case study of ventures; sponsor revenue starts | Stars/sponsor signal |
| **6 · Evolve loop** | ~Dec | evolve v1 (scoreboards, first champion/challenger); processes/ pilot (3 commands + byte-diff-proven adapter) | Venture #2 shipping; portfolio kill-review #1 | Quarter retro |
| **2027 Q1+** | pull-triggered | leads/ops/ledger-module/bench/dashboard/policy-engine per trigger table (§6); trader sandbox last | 2–3 earning ventures + arc sponsors | — |

Two tracks always: **OS track builds only what the venture track pulls.** When in doubt,
the venture track wins the week.

## 3. Cycle 1 — close-out checklist (current work, already planned)

1. Phase 03: ckpt 2 core (~107 refs, first real `100755` moves) → ckpt 3 plan →
   ckpt 4 review (arc-scan subtree ~315 refs) → qa+git (no-op). Per move: golden regen
   (reviewed diff) + byte-diff transcript + dangling-ref check + private evidence dir.
2. Resolve ADR-0020 (stale executable copies in consumer trees — instrument in P3,
   land report half before P4 closes).
3. Phase 04: council-alone → one repo; core+plan → the other; real sessions; evidence.
4. Phase 05: prune-report + attic, README/usermanual rewrite, TRIAL→FAIL promotions
   via trial-ledger, `/arc-retro`.
5. Exit: retro notes feed Cycle-2 kickoff. **Do not gold-plate — banked phases beat
   polished phases.**

## 4. Cycle 2 — Receipt Spine (PLAN v2 final; phase specs worked out)

Full PLAN: `arc-cycle2-receipt-spine-PLAN-v2.md` (9 REQs · appetite 2.5w Tier M ·
ADRs 0021–0028 · 18-kind vocabulary · schema v1). Phase specs:

### phase-00-spec — Spine core (5 days, 2 checkpoints)
**Objective:** the parser-class trio (emitter/validator + replayer + reader) exists,
adversarially hardened, before anything consumes it.
**Ckpt A (~3d) — emit side:**
- `arc-event.sh`: `emit` (hook mode: validate→redact→append; invalid → `_quarantine/`
  + SKIP + exit 0) · `--strict` (exit 2) · canonical serializer + SHA-256 (sha-field
  excluded; UTF-8/LF/sorted keys) · ULID gen · redaction (deny-patterns; fail-safe →
  stub-only `redaction.applied`).
- Hostile corpus pinned (min 12 fixtures): missing field · bad ULID · bad ts · dup idem
  · oversize payload · secret in payload · CRLF/BOM · non-UTF8 · nested-quote breakage ·
  path traversal in evidence · unknown kind · schema-version mismatch.
- **Adversarial construct-a-breaking-input pass on emitter+validator; found holes fixed
  + pinned BEFORE ckpt B starts** (non-negotiable).
**Ckpt B (~2d) — read side:**
- `arc-replay.mjs`: JSONL → derived state; **idem index** (whole-spine, rebuilt on every
  replay); sqlite (node:sqlite, Node 22+) as accelerator; JSONL-scan canonical path.
- `spine` reader v1 (lib + CLI): `--kind`, `--since <ulid>`, `--venture`; cursor
  helpers (read/write consumer cursor files).
- Twin determinism bats in CI: (a) `rm state.db` → replay → identical output;
  (b) no-sqlite leg → identical output. Equivalence gate: sqlite path byte-matches scan.
**DoD:** all fixtures green 3-OS · adversarial report committed · twin determinism in CI.
**Out of scope:** any hook wiring, any brief logic.

### phase-01-spec — Factory wiring (2.5 days)
**Objective:** the existing factory emits receipts without feeling it.
- EVENT.d `NN-emit` fragments (SessionStart/End, PostToolUse summary-level) + explicit
  emissions in kickoff/phase-done/review/qa/commit/ship/council command flows.
- Dry-run scripted session → golden event sequence (REQ-01), order-insensitive in-step.
- Overhead measured (<1s/session event on Windows box; else async append).
- Redaction live on real payloads; destructive-guard chain regression bats.
**DoD:** golden sequence green · overhead measured & recorded · guard chain untouched.
**Out of scope:** revenue, brief, inbox.

### phase-02-spec — Money + brief (2.5 days)
**Objective:** rupees and a one-screen day.
- `arc-event ingest revenue.received --json` (strict): schema + **cross-day idem
  dedupe** fixtures (same payload, different days → one event) · `revenue.simulated`
  path for pre-launch ventures.
- `arc brief` (morning/evening): reader-only; ≤40 lines; groups needs-you / money /
  progress / background; overflow → counts + `--full`; golden-fixtured; <5s.
- Nullable cost fields honored (REQ-08 stretch; first cut under pressure).
**DoD:** REQ-03 + REQ-05 acceptance green · brief golden pinned.
**Out of scope:** approvals, any HTML.

### phase-03-spec — Inbox + API seal (1.5 days)
**Objective:** approvals become receipts; the API becomes law.
- `approval.requested` emission points in kickoff + phase-done (request-your-OK moments)
  · `arc inbox` list · `arc approve/reject ID --reason` → `decision.recorded`.
- Cursor catch-up demo (consumer processes only post-cursor events — bats).
- Reader-only grep-lint enters TRIAL (WARN): no direct `events/*.jsonl`/`state.db`
  refs outside spine module.
**DoD:** REQ-06 + REQ-09 green · full request→decision replay proof.
**Out of scope:** policy engine, auto-routing rules.

### phase-04-spec — Live dogfood (3d effort / ≥5 elapsed days)
**Objective:** real days, real receipts, honest money.
- ≥5 consecutive working days on venture #1: real builds, real briefs read daily
  (≤ one screen held), real `revenue.received` if selling / `revenue.simulated`
  clearly marked if not.
- Weekly gap audit: session-log vs spine (grep compare) — gaps → wiring fixes.
- Evidence bundle: the 5 days' JSONL + briefs + gap-audit output. `/arc-retro` +
  TRIAL promotion review (reader-lint WARN→FAIL candidate).
**DoD:** REQ-07 closed honestly (with real-vs-simulated status stated) · retro done.

## 5. Cycle 3 — First Money (venture #1 launch; worked out)

Precondition: venture #1 core loop works (its build was Cycle-2's dogfood). OS feature
freeze — only retro fixes. Appetite 3 weeks hard.

**Week 1 — payments + pricing:**
- Decision task (1 evening): pick the payment rail. Shortlist for an Indian solo dev
  selling globally: **Paddle / Dodo Payments / Creem (merchant-of-record) · Razorpay
  (domestic INR)** — compare fees, payout time, KYC friction, subscription support.
  Recorded as an ADR in the venture repo. (Stripe India assume closed for new accounts;
  verify only if evidence suggests otherwise.)
- Integrate behind the existing offline-first interface (fake → real impl) · webhook →
  `revenue.received` ingest wired (the spine already accepts it) · test-mode e2e buy ·
  live-mode smoke buy + refund (runbook Stage 5/7 as written).
- Pricing v1: one paid tier, one price. No pricing experiments before customer #10.
**Week 2 — distribution assets:**
- 10–12 SEO pages via seo-article-writer (keyword list from real complaint language) ·
  landing polish via `/arc-design` (score ≥8) · analytics (privacy-light) · OG/social
  assets · docs/FAQ page · launch copy drafts.
**Week 3 — launch week:**
- One channel per day: Product Hunt · HN Show · 2–3 niche subreddits/communities ·
  Indie Hackers · X/LinkedIn build-in-public thread. Personal, non-spammy, honest.
- `/arc-canary` post-deploy watch · support = manual triage, drafts allowed ·
  daily brief reads with REAL revenue events.
**Success gate:** ≥1 real paying customer + baseline funnel (visits→signup→pay).
**Pivot rule:** launch push done + <500 unique visits or 0 signups → STOP building;
one positioning/channel cycle before any new feature. **Optional cash lane** (only if
income pressure): open the "MVP-in-7-days" service offer in 2 credible places — deferred
by default; it buys money but costs the roadmap's focus.

## 6. Cycle 4+ — pull-triggered modules (build NOTHING before its trigger)

| Module | Trigger (pull) | Scope recap when pulled |
|---|---|---|
| growth v1 | venture live + needs traffic (expected: Cycle 4) | content/SEO engine **+ faceless-video pipeline** (script→TTS→assemble→upload, channels tied to ventures) on the reader API; A/B via evolve later |
| discover v1 | ready to pick venture #2 | one source (Reddit) → cluster → score → council verdict |
| memory v1 | playbooks outgrow grep OR ≥2 workflows need recall | FTS5 search over playbooks/decisions + recall CLI for any process (embeddings only if FTS proves insufficient) |
| engine v1 | arc public prep OR 2nd runtime genuinely needed | 3 drivers (claude-code, codex, generic API) + hand-edited router.yaml |
| processes/ pilot | engine v1 exists | 3 commands canonicalized; adapter output byte-diff-proven |
| evolve v1 | ≥1 venture with 4+ weeks of metrics | scoreboards → first champion/challenger with sample floors + holdout + rollback |
| leads v1 | a venture/service needs outbound | ICP + enrichment + capped sequences (≤20/day, L1→L2 by evidence) |
| ops v1 | ≥2 live ventures | canary sweep + support triage drafts + weekly health report |
| ledger module | ≥2 revenue sources | P&L views, kill-distance meters (events already exist) |
| bench runner | ≥2 drivers disagree on quality | eval packs → scored routing table |
| dashboard (HTML) | brief outgrows one screen repeatedly | the mock, wired to the reader API — skin only |
| chat interface (HQ MCP) | dashboard exists + conversational queries wanted | MCP server over the reader/inbox (`hq_query`, `hq_brief`, `hq_approve`) — "talk to the company"; same API, no new truth |
| policy engine | ≥3 action kinds running ≥L2 | capability vectors enforced at runner + hooks |
| scheduler | first process earns L3 | cron → headless runs with budgets; cursors go event-driven |
| trader sandbox | monthly revenue exists + Ashiq explicitly opens it | paper-only, own instance/creds/policy, 72h-cooldown real-money rule, circuit breaker |

## 7. Money model + milestones (honest ranges, not promises)

| When | Milestone | Source |
|---|---|---|
| Sep 2026 | **First real ₹** (customer #1) | venture #1 launch |
| Oct–Nov 2026 | ₹10–30k MRR | venture #1 growth + (maybe) service lane |
| Nov–Dec 2026 | + arc sponsors begin | arc public launch |
| Dec 2026 | **₹25k MRR** (stretch ₹50k) | venture #1 + sponsors + venture #2 early |
| Mid-2027 | **₹1L+ MRR** | 2–3 earning ventures + arc revenue + content |
| 2027+ | arc itself as SaaS (existing plan) | public repo → cloud/team features |

Rules: expect 1-in-4 ventures to live (portfolio math) · every venture ships WITH a
distribution plan or doesn't ship · trading is never in this table's load-bearing rows ·
opportunistic byproducts (e.g. selling the venture boilerplate/skeleton, ShipFast-style)
may add revenue but never get their own cycle — **ship-with, not build-for**.

## 8. Autonomy roadmap (trust earned per quarter)

- **Q3 2026 (now):** everything human-started, L1. The spine watches.
- **Q4 2026:** content publish L1→L2 (20 unedited approvals evidence) · deploys L2
  (arc-gated already) · first scheduled runs (nightly brief compile) when scheduler is pulled.
- **Q1 2027:** outreach L2 capped · support drafts 92%+ unedited → L2 · evolve
  proposals flowing · discover nightly headless.
- **Later:** L3 only via trial-ledger, auto-demote on incident, forever-human list
  unchanged (kickoff/kill/pricing/refunds/ad-spend/real-money/name-publishing).

## 9. Ashiq's operating rhythm

- **Daily (~30–60 min):** read the brief · clear the inbox (approve/reject with reasons —
  each is calibration data) · one venture-forward action (a phase step, a launch task,
  a customer reply). Everything else is the machine's.
- **Weekly (~1 hr):** `/arc-retro` cadence — gap audit, scoreboard glance, one
  improvement promoted, one thing killed or simplified.
- **Per cycle-gate:** the decision meeting with yourself: bank/cut/kill per kill
  criteria; approve next cycle's kickoff. Never mid-cycle scope adds — `/arc-change` or it waits.

## 10. Portfolio kill criteria + top risks

**Kill criteria (system level):**
- 2 full build→launch cycles with zero revenue AND zero audience growth → stop building;
  one full cycle on distribution/positioning only.
- Any OS cycle whose output no venture uses within the next cycle → that module freezes.
- Weekly: OS-hours > venture-hours two weeks running (outside a sanctioned OS cycle) →
  OS freeze until a venture ships something.
- Venture-level: kill-criteria set at ITS kickoff (e.g. 60 days no paying user + weak
  organic signal → attic + harvest components).

**Top-5 risks:**
| Risk | Mitigation |
|---|---|
| Factory-polishing addiction (the #1 real threat) | §10 weekly rule + pull-triggers + venture track wins ties |
| Launch produces silence (distribution is the hard part) | Cycle-3 pivot rule; audience building starts with build-in-public from Cycle 2 |
| Parser-class holes poison the spine | Phase-00 adversarial pass + pinned corpus + twin determinism CI |
| Solo burnout | appetites are caps not stretch goals; banked > perfect; the brief keeps wins visible daily |
| Payment/KYC friction (India) | MoR shortlist decided in one evening, ADR'd; domestic Razorpay fallback |

## 11. Master decision log (everything locked so far)

1. Mission sentence + 5 laws (§0) · north-star ₹/hr.
2. Vocabulary: Kernel / Workflows / Ventures; 16 modules; `products/` machinery
   unchanged until public-release rename (demand-triggered).
3. Capability duplication banned via lint (`uses:` declarations), not via 12-way split.
4. Steel thread before organs; organs by pull-trigger only (§6).
5. Receipt spine per PLAN v2: ADRs 0021–0028 (canonical JSONL truth · instance-only ·
   18-kind closed vocabulary · CLI-first · stub-only redaction · immutability windows ·
   **spine = only public API, cursors not bus** · dual-mode emitter).
6. JSONL-scan canonical on Node ≥18; node:sqlite optional accelerator; native deps banned.
7. `revenue.received` real-only; simulated separated; P&L truth never polluted.
8. Model-agnostic via processes/ + adapters + drivers/router; bench when pulled;
   byte-diff for migration proof only.
9. Evolve: propose-only, sample floors, champion/challenger, holdouts, auto-rollback.
10. Policy: capability vectors, deny-by-default; forever-human list; incident = demotion.
11. Trader: isolated instance/creds/policy, paper-first, 72h-cooldown real-money unlock,
    circuit breaker, never load-bearing.
12. Payments: MoR route (Paddle/Dodo/Creem) global + Razorpay domestic; ADR at Cycle 3.
13. Approval gate: every cycle/implementation starts only on explicit "pannu".
14. **The arc Constitution** sits above this plan (precedence: Constitution > ADRs >
    PLAN > code): 3 eternal articles (receipts · human sovereignty · truth) + 10 working
    articles, two-tier amendability (Tier E unamendable; Tier A = ADR proposal + 7-day
    cooling + human sign-off + `constitution.amended` event), machines may cite but never
    amend, enforcement via process preambles (the model-alignment layer) + kickoff-lint
    citation check (TRIAL) + /arc-change step-0 + council lens. Draft:
    `arc-CONSTITUTION-draft.md`; adopted only on Ashiq's sign-off (first
    `constitution.adopted` spine event).

## 12. Immediate next actions (this week)

1. **[Ashiq]** Continue Cycle-1 Phase 03 ckpt 2 (core re-homing) — the only coding work
   that should be happening right now.
2. **[Ashiq]** Confirm venture #1 = InvoiceFly (or swap) — Cycle 2 Phase 4 and Cycle 3
   both key off it.
3. **[Together, after 03–05 close]** `/arc-kickoff` Cycle 2 with PLAN v2 as input;
   kickoff-lint it; phase-00-spec first.
4. **[Optional, zero-cost now]** Start the build-in-public thread habit (one honest
   post per phase close) — it compounds into Cycle-5's launch audience.

## Appendix D — coverage map (where every discussed idea lives)

Audit of the full planning conversation (2026-07-18). Docs: **[M]**oney-engine plan ·
**[B]** HQ blueprint · **[A]** full architecture · **[V]** v2.1 verdicts · **[P]** Cycle-2
PLAN v2 · **[X]** this master plan · **[D]** dashboard mock.

| Discussed | Where it lives |
|---|---|
| 5 original money ideas scored (leads-service 8.5 · SaaS factory 8 · trading 2 · pain-mining 9 · faceless video 6/8) | M §3; modules: leads/discover/growth/trader (X §6) |
| Extra ideas: sell arc itself · 7-day MVP service · SMB vertical AI workers · boilerplate sales · programmatic SEO | M §4; X §2 Cycle 5 (arc public) · §5 optional cash lane · §7 byproduct rule · growth scope |
| JARVIS-style dashboard / "second brain for business" (name = arc) | D (design target) · ADR-0024 · X §6 dashboard row |
| Daily loop: auto idea capture → store → council → kickoff → build → ship → market → money | B §4 rhythm · X §2 roadmap + §9 rhythm · P (the spine that records it) |
| "Everything stored / oru naal la ellame dashboard-la" | Receipt spine: P (ADRs 0021–0028) + X §4 |
| Talk to the company (chat/MCP) | B §2.5 · X §6 chat-interface row |
| Autonomy ladder L0–L4 + approval inbox + exact permission matrix | B §2.4 · V §V7 (matrix) · P REQ-06 · X §8 |
| Self-improvement for EVERY module (evolve contract, calibration, retro accretion, experiments, decision memory) | B §3 · A §5 · V §V6 · X decision log #9 |
| Moat / "AI evolution aanalum kastam" (data + calibration + audience + taste; models = tailwind) | B §6 · A §4.4 (bench) |
| Model-agnostic any-LLM (ChatGPT/Claude/z.ai/Gemini/open-source/future) | A §4 (processes/adapters/drivers/router/bench) · X §6 engine+processes+bench rows · decision log #8 |
| 16 modules, kernel/workflows/ventures, capability-duplication lint law | A §2–3 · V §V1 · X decision log #2–3 |
| SQLite doubt → data layer answer | A §6 · ADR-0021 · X decision log #6 |
| Review round 1 (10 points + capabilities layer) | V (full verdicts) |
| Review round 2 (10 points + spine-as-OS-API) | P Appendix C · ADR-0027/0028 |
| Receipt spine full spec + phase specs | P · X §4 |
| First money / venture #1 launch (payments, SEO, launch week, pivot rule) | X §5 |
| India payments (MoR: Paddle/Dodo/Creem · Razorpay domestic) | M · X §5 W1 + decision log #12 |
| Trading honesty + isolation (paper-first, 72h cooldown, circuit breaker, never load-bearing) | M §3 · V §V8 · X §6 + §7 + decision log #11 |
| Faceless video as distribution arm (dual-purpose) + Higgsfield synergy | M §3/§5 · X §6 growth row |
| Content/SEO engine (seo-article-writer exists) | M · A Ring 2 · X §6 growth |
| Ops (canary, support triage, health reports) · Ledger (P&L, kill-distance) | A Ring 2 · X §6 rows |
| Memory module (playbooks, FTS5, recall) | A Ring 1 · X §6 memory row |
| Build-in-public habit → launch audience | X §12.4 → Cycle 5 |
| North-star ₹/month-per-hour + noise budget + kill criteria (system/venture/OS-freeze) | X §0 · §10 · P REQ-05 |
| Approval gate ("pannu" rule), feat-branch workflow, current-cycle no-gos sacred | X decision log #13 · §3 · project memory |
| Cost honesty (nullable cost, profit-per-AI-₹) | P REQ-08 · D (return metric) · ledger scope |

Gaps found by this audit and fixed in v1.1: `memory` row, `chat/MCP` row, explicit video
pipeline in growth, byproduct-revenue rule. Everything else was already present.

— end of master plan v1.1 —
