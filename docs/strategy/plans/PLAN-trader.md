# PLAN-trader.md — trader sandbox · "The Lab" (permanently special)

> **Version:** v1.1 — landed owner-approved 2026-08-10 ("repo la podu"). Decisions
> TRD-A…M locked over 3 review rounds 2026-08-03 → 2026-08-10 (round 1: 8 holes ·
> round 2: multi-perspective, 12 ideas · round 3: friction audit — *"automate the
> honesty, never bureaucratize the curiosity"*). Adjudication: Appendix A. Rejected
> alternatives: §13.
> **Status:** IN REPO (working tree, disk-only drop — no git by the machine). Ashiq
> branches/commits/PRs himself. Landing record: §14.
> **Trigger:** CONVERTED under the owner's **Build-out Mandate** (2026-08-09 — same
> `decision.recorded` as strategy-README correction #15, cited by the kickoff ADRs;
> A8's letter kept). The brief's revenue double-gate no longer gates the build —
> deviation recorded in §12.1. Everything E2-related is untouched and untouchable.
> **Precedence:** Constitution (**LAW — adopted v1.0, 2026-08-06**) > ADRs > this
> PLAN > code. Cited articles: E2 (human sovereignty) · E3 (truth) · A5 (one source
> of truth) · A9 (appetite is a cap); A8's letter kept via the mandate receipt.
> **Tier:** S+ — 1 week build effort + 30 trading days background elapsed.
> **Lane:** `trader` — NEW lane, born only at `/arc-kickoff --lane trader`; claims
> the **next free ADR century per `PORTFOLIO.md`** at birth (never hardcoded here —
> the 0300s went to evolve, 0400s leads, 0500s policy, 0600s absorb; the board is
> the authority). ⚙ marks kickoff-tunable placeholder values (the ₹500/₹100 pattern).

---

## §0 · Mission and honest expectations

**One-liner:** a fully isolated paper-trading research lab — strategies as tiny
declarative specs, deterministic walk-forward simulation on sha-pinned data
snapshots, honest metrics after pessimistic Indian costs, everything a receipt in
trader's OWN event stream — with the real-money path locked behind five conditions
and a spine-clock 72-hour cooldown.

**What this is NOT:** an income stream. Retail algo trading is negative-sum after
costs; as income it scores 2/10 (money-engine record, 2026-07-18). This module
builds the 5/10 version: **capped R&D that satisfies curiosity with receipts instead
of losses.** Trading never appears in a load-bearing revenue row (master plan §7).
Not financial advice — the module's whole point is that no claim is trusted without
evidence.

**Honesty note (Build-out Mandate conversion, pack pattern):** no revenue receipt
exists and none is invented — the live spine's money side is untouched by this
module forever. Unlike the other mandate conversions, trader has NO deferred
live-value revenue milestone: income is permanently out of its claims by design.
Its stated value is (1) answered research questions with receipts and (2) the
autonomy-calibration evidence below. The brief's written-opening trigger leg
survives in spirit as the kickoff approval itself.

**North-star metric (trader's own):** *time-to-honest-verdict and cost per answered
research question.* Never profit. "Profit" is not even a verdict word (TRD-F).

**Second product (free byproduct):** trader is the only arc module with **zero
real-world blast radius** — fake money, isolated stream. Its 30-day live loop is
therefore arc's safest full-autonomy exercise: caps, circuit breakers, incident →
demote, policy enforcement all get exercised daily, live. That evidence feeds every
OTHER module's L2/L3 promotion decisions. The sandbox is arc's flight simulator.

## §1 · Current state this plan is grounded on (verified 2026-08-10)

**Exists:** receipt spine + reader + brief + inbox (C2) · lanes world + PORTFOLIO
board (C4) · balanced model policy (C5, ADR-0063–0071) · develop harness (C6, merged
PR #100) · engine v1 + generated commands (C6, merged PR #103) · **Constitution =
LAW** (adopted v1.0, 2026-08-06 — root `CONSTITUTION.md`, receipted + sha-pinned) ·
**policy engine LIVE** (arc-policy C9; code merged 2026-08-08, PR #130; root
`hq.policy.yaml`; POL-G/POL-I in force) · `metric.observed` vocabulary = law
(ADR-0408, leads' cycle) · `/arc-capability` vetting gate (ADR-0110) · evolve module
BUILT C7 (fixture-proven, unexercised — growth's feed owns its trigger clock).

**Landed plans, lanes not yet born:** scheduler · ledger · growth · memory ·
legal-pack · ops · executor (engine-lane) — all promoted 2026-08-09/10 under the
Build-out Mandate. Sleeping on triggers: leads P05 (offer), absorb next steps,
bench/dashboard/chat-mcp (BRIEFs).

**Graceful-degradation table** — lets the owner slot this build anywhere in the
build-out sequence; nothing below blocks an early kickoff:

| Dep | State today | What trader does if it kicks off FIRST | What upgrades when the dep's lane ships |
|---|---|---|---|
| policy engine | **LIVE (C9)** | `trader.policy.yaml` stays module-local by design (own instance, TRD-A); trader adds ZERO company action kinds (TRD-M) so no `hq.policy.yaml` rows are needed at v1 (memory's "POL-I n/a" precedent). The LOCK's cap/auto-L0 semantics align with the live two-key model | if trader actions ever register at `arc-run`, their rows land via POL-I in the same change |
| ledger | plan landed, lane unborn | cost-of-curiosity meter renders `cost: UNKNOWN` — nullable-cost honesty, never ₹0 | full meter: "curiosity cost ₹X · real-money would be −₹Y · **sandbox saved ₹(Y−X)**" |
| scheduler | plan landed, lane unborn | daily loop via OS scheduled task invoking `trader day --strict`; heartbeat receipt every run; count receipt-derived | daily loop registers as a **script-class ₹0 `hq.jobs.yaml` job** (jobs-lint · idem=job@slot · zero scheduler-layer retries — SCH law; the lexos-canary reconciliation precedent applies if names collide) |

**Recommended slot:** LAST in the build-out queue — after the ledger + scheduler
lanes ship, because both integrations are structural (and "last" was always this
module's honest place). The table above makes any earlier slot safe. Owner's call
at kickoff; the A9 live-slot gate applies either way.

## §2 · Decision record — TRD-A…M (locked in review; ADR numbers assigned at kickoff)

**TRD-A · Isolation model — mold, lane and instance are three different things.**
Code mold lives in the arc monorepo (`products/trader/`), developed in lane
`initiatives/trader/` like any module. The RUNTIME is a separate **trader instance
dir** with its own event stream (`.claude/state/trader/events/` inside the instance
— never synced; ADR-0022 pattern), own creds file, own `trader.policy.yaml`. HQ
merges trader events **read-only** through the reader. A lint fixture proves trader
code cannot import from or emit into any other module's stream or state.
*Consequence:* deleting the whole trader instance harms nothing else in arc.
*Rejected:* running inside the HQ instance — cheaper, but isolation stops being
provable (§13 R-01).

**TRD-B · Two-zone law — the creativity/rigor split.**
Zone 1 **PLAYGROUND**: `trader play <spec>` — instant backtest, no registration, no
budget, unlimited runs. Every output is watermarked `EXPLORATORY — NOT EVIDENCE`;
events carry `zone: exploratory`; playground results CANNOT produce verdict-class
reports (fixture-proven — the verdict renderer hard-fails on exploratory input).
Zone 2 **VERDICT LAB**: `trader register <spec>` (one command, ~2 seconds — emits a
sha-pinned registration receipt) → full honesty battery → verdict vocabulary
unlocked. Boundary rule: *playground says "interesting"; only the lab says "true."*
Guards tax CLAIMS, never CURIOSITY. *Consequence:* iteration speed (the fuel of
research creativity) is preserved at full; rigor concentrates where a claim is made.
*Rejected:* registration required everywhere — kills play, module goes unused
(§13 R-02).

**TRD-C · Strategy specs are tiny declarative data, never code.**
YAML, sha-pinned, schema-validated (parser-class → adversarial pass mandatory
before anything consumes it). v1 primitive classes, exactly three: **entry rule**
(fixed indicator menu: SMA/EMA cross · RSI threshold · N-day breakout), **position
sizing** (fixed fraction of paper capital), **exit** (stop % · target % · time
stop). A complexity-budget lint caps total conditions per spec (⚙ 4). No loops, no
expressions, no user code — spec expressiveness is the enemy of honesty: every
added primitive multiplies the overfitting search space. *Rejected:* embedded
formula DSL (§13 R-03); arbitrary Python/JS strategies (§13 R-04).

**TRD-D · Data discipline.**
v1 scope: **ONE instrument class — Indian index exposure via a NIFTY-tracking index
ETF, EOD bars** (recommendation; final instrument confirmed at kickoff via
`/arc-capability` vetting of source + fallback). Rationale: spot-like delivery
costs, zero leverage (matches the no-leverage no-go), no expiry mechanics, minimal
corporate-action surface, official free EOD data exists (NSE bhavcopy class).
Snapshots are immutable files with sha receipts (`snapshot.pinned` events); every
backtest names its snapshot sha — REQ-3 determinism is impossible without it.
Corporate-action handling is explicit config; split/dividend fixtures are in the
adversarial pack. The live-paper feed is archived daily and sha'd so any 30-day run
replays byte-identically (A5: derived state deletable, truth rebuildable).
*Rejected:* multi-instrument v1 (§13 R-05); intraday/tick v1 (§13 R-06); crypto v1
(§13 R-07).

**TRD-E · Honest-metrics law — the report cannot lie.**
Costs modeled pessimistically from an explicit India cost-table config — brokerage,
STT, exchange transaction charges, SEBI turnover fee, stamp duty, GST on
(brokerage + transaction charges), plus a slippage floor in bps (⚙) — sourced from
real broker charge sheets with receipts attached at kickoff (values live in config,
never hardcoded, because they change). Walk-forward split enforced in code; a
strategy evaluated on its own training window FAILS the report lint. Min-trade
floor (⚙ 30 trades) below which no verdict is issued. Every verdict-class report
MUST contain: (1) after-cost performance vs **buy-and-hold of the same instrument**
and vs cash; (2) **null-monkey percentile** — placement inside a distribution of
⚙100 random-entry strategies with matched trade frequency on the same window,
generated with seeds derived from spec-sha + snapshot-sha so the distribution
itself is deterministic; (3) **attempt-family disclosure** — "N registered attempts
in this family; best expected by chance ≈ X" (deflated-Sharpe-style luck
adjustment); (4) **regime tag** — the walk-forward window must span ≥2 mechanically
defined volatility regimes (trailing realized-vol percentile buckets, thresholds ⚙)
or the verdict carries `UNTRUSTWORTHY-SINGLE-REGIME`; (5) the cost/slippage config
surfaced inline. *Principle:* a pass condition that is only an absence cannot
detect mediocrity — the report's honesty is positive mandatory content, not absence
of cheating.

**TRD-F · Verdict vocabulary — no WIN state.**
Exactly three verdicts: `LOSES` · `INDISTINGUISHABLE-FROM-LUCK` ·
`SURVIVES-SO-FAR`. The word "WINS" does not exist in the module (a lint proves it).
A losing sim is reported as losing, never reframed (E3). The best sentence
this module can ever emit is "survives so far."

**TRD-G · Attempt ledger + hypothesis budget (confirmatory zone only).**
Every REGISTERED run is an event; the family attempt count is **derived by replay**,
never self-reported (a tamper fixture pins the difference). Registrations are
capped (⚙ 5/month) because LLMs make hypothesis generation free, and overfitting
industrializes without scarcity. Playground runs are unlimited and never counted.
*Rejected:* budgeting all backtests — an anti-creativity mistake caught in round 3
(§13 R-08).

**TRD-H · Graduation ladder, slots, prediction ledger — no gate ceremony.**
States: `DRAFT → REGISTERED → BACKTESTED → PAPER-LIVE → VERDICT-ARCHIVED`. All
transitions automatic except **paper-live entry**, the single human decision point:
paper slots are limited (⚙ 3). At entry, predictions are RECORDED, not gating —
owner (and council when convenient) logs "will this survive 30 days?" with a
confidence number; outcomes land in the calibration/Brier ledger 30 trading days
later. Calibration data flows; zero blocking ceremony. *Rejected:* mandatory
council session per strategy (§13 R-09).

**TRD-I · Paper-live run mechanics + divergence law.**
A "run" = **30 consecutive scheduled trading days** (exchange calendar; holidays
excluded by definition). Missed day → `incident.raised` receipt + documented cause;
more than ⚙3 gaps invalidate the run (restart). Daily loop = a script-class ₹0 job:
via the scheduler's `hq.jobs.yaml` once that lane ships (jobs-lint · idem=job@slot ·
zero scheduler-layer retries), or an OS scheduled task invoking `trader day
--strict` until then (§1 table); either way every run emits a heartbeat receipt and
**the 30-day count is derived from receipts, not assumed** — a silent gap is
structurally impossible to report as clean. Daily output: 1 summary line into the brief's
background group; weekly report ≤10 lines (noise budget, golden-fixtured).
**North metric of the run: daily backtest-expectation vs paper-fill divergence.**
Divergence beyond band (⚙) → cost-model recalibration required + all open verdicts
flagged `MODEL-SUSPECT`. The run's first job is proving the SIMULATOR honest;
strategy performance is second. *Rejected:* calendar-day run definition (§13 R-10);
wall-clock anything (§13 R-11).

**TRD-J · The LOCK — build the lock, not the trading.**
v1 contains **no real-order code path at all**; the lock is proven against a stub
broker, and **broker credentials must not exist** in the v1 instance (creds
inventory check in CI — you cannot leak a key that was never created). Real-money
activation requires ALL FIVE, forever:
(a) handwritten edit to `trader.policy.yaml` by Ashiq;
(b) **72h cooldown enforced by spine receipts** — an `unlock.requested` event plus
    ≥3 subsequent company-spine `day.closed` receipts; wall-clock is never
    consulted (clock tampering is a pinned fixture);
(c) hard caps in the same policy file — max capital, max daily loss; breach →
    automatic L0 + circuit breaker;
(d) `decision.recorded` on the company spine citing the evidence report ULID;
(e) **compliance review recorded** — current SEBI retail-algo rules + broker API
    terms + tax treatment verified and receipted AT UNLOCK TIME (rules evolve;
    verify then, not now).
During the cooldown the system auto-generates the **ANTI-CASE report** (worst
drawdowns, luck-adjusted truth, divergence status, cost meter) into the inbox;
final approval must cite its receipt. Any attempt to reach the stub broker's "real"
mode without a–e = blocked + `incident.raised` (one fixture PER condition).
Red-team budget: **≥1 full day of the appetite.** *This is E2 territory: real-money
unlock is not a phase of this or any plan — it is a separate future decision the
owner makes alone. No doctrine change touches it.*

**TRD-K · Question-driven cycles, autopsy, terminal state.**
Each 30-day cycle opens with ONE research question recorded as a `question.opened`
event ("does momentum survive costs on NIFTY EOD?"); the cycle's verdict answers
that question. Every verdict triggers a short **autopsy note** ("why it probably
failed / held") pinned to the trader playbook — negative knowledge compounds and is
the module's real yield. After 2 complete cycles the retro MUST choose `CONTINUE`
(fresh written owner note) or `DORMANT` (lane parked, data archived). Curiosity is
satisfiable; the sandbox has an exit door.

**TRD-L · Reuse law.**
Verdict statistics reuse evolve's pinned fixed-horizon test pattern (effect floor,
config-hashed parameters) rather than inventing a second stats engine. The
simulator is deterministic code — **no LLM anywhere in the compute path**; LLM use
is limited to playground spec drafting and report prose, per the balanced model
policy (ADR-0063–0071). Trader's daily metric receipts make it a clean future
client for evolve.

**TRD-M · Event vocabulary is trader-stream-local.**
The company spine keeps its closed vocabulary (ADR-0023; count derived from live
`KINDS.length`, ADR-0107 rule — never hardcoded) — trader does not pollute it:
**zero company kinds added**. Trader's OWN stream defines its own closed kind set
(§5.7; finalized at kickoff). HQ ingests via read-only merge; anything crossing
INTO the company spine maps through existing company kinds only
(`decision.recorded`, `incident.raised`, `approval.requested`). If any trader
metric is ever emitted company-side it conforms to the live ADR-0408
`metric.observed` validator and is **explicitly NOT evolve's trigger feed** —
growth's GSC feed owns that clock (the ops-plan honesty boundary, applied
identically).

## §3 · Requirements (all measurable, all fixture-proven)

| # | Requirement | Acceptance evidence |
|---|---|---|
| REQ-1 | **Isolation proven** — own instance dir, own stream, own creds (v1: data creds ONLY; broker creds must not exist), own policy file; cross-module import/emit lint | lint red on a planted violation, green on the tree; creds-inventory check in CI |
| REQ-2 | **Two-zone enforced** — exploratory watermark on every playground output; playground cannot emit verdict-class reports; `register` = one command → sha-pinned receipt | verdict renderer hard-fails on exploratory input (fixture); registration round-trip receipt |
| REQ-3 | **Deterministic backtest** — same snapshot sha + spec sha → byte-identical report (null-monkey distribution included, via derived seeds); costs from explicit config surfaced in every report | twin-run byte-diff in CI; cost-table receipt attached |
| REQ-4 | **Honest-report battery** — training-window eval FAILS lint · attempt-family N disclosed (replay-derived) · null-monkey percentile · buy-and-hold + cash baselines · regime tag · min-trade floor · three-verdict vocabulary, no WIN | one fixture per battery element; a deliberately-overfit planted strategy must come out `INDISTINGUISHABLE-FROM-LUCK` |
| REQ-5 | **Paper-live loop** — 30 scheduled-trading-day definition with receipt-derived count + missed-day incident rule; daily 1-line + weekly ≤10-line brief output; drawdown circuit breaker fires in sim | fixture-simulated month incl. gap day + breaker day; brief noise-budget golden |
| REQ-6 | **Divergence tracking** — daily expectation-vs-fill metric; band breach → `MODEL-SUSPECT` flags + recalibration path | fixture with injected slippage shift → flag fires; recalibration receipt |
| REQ-7 | **The LOCK proven locked** — conditions a–e; spine-receipt 72h (never wall-clock); anti-case generated + citation required; stub-broker real-mode attempt without a–e = blocked + incident | one fixture PER condition + clock-tamper fixture + committed red-team report |
| REQ-8 | **Lifecycle honesty** — prediction ledger at paper-entry; autopsy note per verdict; question-driven cycle wiring; terminal-state fork wired into retro | prediction→outcome round trip on fixtures; retro template contains the CONTINUE/DORMANT fork |

## §4 · Worked examples (what the surfaces actually look like)

### 4.1 A strategy spec (the whole thing — this is the point)

```yaml
# specs/sma-cross-20-50.yaml        (sha-pinned at registration)
schema: trader-spec/v1
name: sma-cross-20-50
question: q-2026-001          # the research question this belongs to
entry:                        # primitive 1 of 3 — from the fixed menu only
  rule: sma_cross
  fast: 20
  slow: 50
sizing:                       # primitive 2 of 3
  rule: fixed_fraction
  fraction: 0.95
exit:                         # primitive 3 of 3
  stop_pct: 5
  time_stop_days: 60
# complexity budget: 4 conditions max (⚙) — this spec uses 3
```

### 4.2 Registration receipt (trader stream, canonical JSONL — ADR-0021 serialization)

```json
{"kind":"spec.registered","payload":{"family":"sma-cross","month_count":"2/5","name":"sma-cross-20-50","question":"q-2026-001","spec_sha":"9f2c…","zone":"lab"},"sha":"…","ts":"2026-11-04T09:12:31.000Z","ulid":"01JD…"}
```

### 4.3 A verdict report (golden shape — dummy numbers)

```
VERDICT REPORT · sma-cross-20-50 · snapshot 4b1e… · config costs-v1 (inline below)
window: 2019-01→2026-06 walk-forward (train/validate/walk enforced; regimes: LOW-VOL + HIGH-VOL ✓)
trades: 47 (floor 30 ✓)
after-cost return:      +3.1%/yr
buy-and-hold baseline:  +11.4%/yr        cash baseline: +6.5%/yr
null-monkey percentile: 61st of 100 matched-turnover randoms (seeded, reproducible)
attempt family: 4 registered attempts; best-by-chance ≈ 68th percentile
costs applied: brokerage+STT+exchange+SEBI+stamp+GST per config costs-v1 + 12bps slippage floor
──────────────────────────────────────────────────────────────
VERDICT: INDISTINGUISHABLE-FROM-LUCK
(beats neither baseline after costs; percentile within luck band for a 4-attempt family)
autopsy → playbooks/trader/2026-11-sma-cross.md
```

### 4.4 `trader.policy.yaml` v1 (ships in this exact state)

```yaml
schema: trader-policy/v1
mode: PAPER_ONLY                # the only mode that exists in v1 code paths
real_money:
  enabled: false                # condition (a) = Ashiq hand-edits this file
  unlock_requires:              # informational — enforcement is in code + fixtures
    - handwritten_edit
    - spine_cooldown_72h        # unlock.requested + >=3 company day.closed receipts
    - hard_caps_set
    - decision_recorded
    - compliance_review_recorded
  hard_caps:
    max_capital_inr: null       # must be set by hand at unlock; null = invalid
    max_daily_loss_inr: null    # breach → auto-L0 + circuit breaker
paper:
  slots: 3                      # ⚙
  registrations_per_month: 5    # ⚙
  drawdown_breaker_pct: 15      # ⚙ fires in sim too (REQ-5)
```

### 4.5 Brief output (noise budget enforced)

Daily (1 line, background group): `trader: day 14/30 · 3 live specs · divergence OK · breaker quiet`
Weekly (≤10 lines): question · per-spec 1-liners · divergence status · cost meter (or `cost: UNKNOWN`) · incidents.

### 4.6 India cost table (component list fixed; values ⚙ from broker charge-sheet receipts at kickoff)

`costs-v1.yaml`: brokerage (per side) · STT · exchange transaction charges · SEBI
turnover fee · stamp duty (buy side) · GST on (brokerage + transaction charges) ·
slippage floor bps ⚙ · spread floor ⚙. Every report prints which cost config it
used; changing the config = new config sha = old reports untouched (A5).

## §5 · Architecture detail

### 5.1 Directory layout

```
arc mold:      products/trader/{spec/, sim/, report/, lock/, policy/, cli/}
lane (diary):  initiatives/trader/{PLAN.md, PROGRESS.md, phases/, evidence/}
instance:      <trader-instance>/
                 .claude/state/trader/events/YYYY-MM-DD.jsonl   # own stream, never synced
                 snapshots/  specs/  reports/  playbooks/
                 trader.policy.yaml  creds/data-feed.env        # NO broker creds — CI-checked
```

### 5.2 Backtester engine (the honesty-critical mechanics)

- **No-lookahead execution convention:** signals compute on close[t]; execution at
  open[t+1] with slippage floor applied (⚙ config; the lookahead fixture plants a
  same-bar-close trade and must fail).
- **Walk-forward:** parameters may only be chosen using data strictly earlier than
  the window they trade; the splitter emits the window map into the report; a
  training-window evaluation trips the report lint (REQ-4).
- **Determinism:** inputs = (snapshot sha, spec sha, cost-config sha); null-monkey
  seeds derived from those shas → the ENTIRE report byte-reproduces (REQ-3).
- **Null-monkey generator:** ⚙100 random-entry strategies with matched trade
  frequency and identical sizing/exit/cost treatment on the same window → percentile
  placement. "Your strategy beat 61% of random monkeys" is the most honest sentence
  a backtest can emit.
- **Regime tagger:** trailing realized-vol percentile buckets (thresholds ⚙); the
  window must contain days in ≥2 buckets or the verdict is tagged
  `UNTRUSTWORTHY-SINGLE-REGIME`.

### 5.3 Data pipeline

Fetch (vetted source) → normalize → corporate-action policy applied (explicit
config) → snapshot file frozen + sha receipt → backtests reference snapshot sha
only. Live-paper daily bars are archived the same way, so a finished 30-day run
replays end-to-end. Secondary source named at kickoff; a source/feed change mid-run
is detectable because divergence + snapshot shas expose it (P-4, §9).

### 5.4 Attempt ledger & divergence

Attempt counts are derived by replaying `spec.registered` events per family — never
read from a mutable counter (tamper fixture pins this). Divergence = |expected fill
(sim, from yesterday's close signals) − paper fill (today's open on archived feed)|
aggregated daily; band breach (⚙) → `MODEL-SUSPECT` flag on all open verdicts +
recalibration path (cost-config bump = new sha = clean lineage).

### 5.5 CLI surface (receipts-first)

`trader play <spec>` · `trader register <spec>` · `trader backtest <spec-id>` ·
`trader paper start|day|status` · `trader report [--weekly]` · `trader verdict
<spec-id>` · `trader question open "<q>"` · `trader policy lint`. Every command
emits its receipt before printing anything human-readable.

### 5.6 Flow (one cycle, end to end)

question.opened → playground iteration (free, watermarked) → register (budgeted,
sha-pinned) → lab battery → slot decision + predictions recorded → 30 scheduled
trading days paper (cron heartbeats; divergence watched; breaker armed in sim) →
verdict (three-word vocabulary) + autopsy → question answered → after 2 cycles:
CONTINUE (fresh written note) or DORMANT.

### 5.7 Trader-stream event kinds (closed set, proposal — finalized at kickoff)

`question.opened` · `spec.registered` · `snapshot.pinned` · `run.completed`
(zone-tagged) · `day.closed` (trader-local) · `report.published` ·
`prediction.recorded` · `verdict.recorded` · `incident.raised` ·
`unlock.requested`. Payload schemas follow the spine's canonical serialization
(UTF-8/LF/sorted keys, sha excludes itself — ADR-0021 pattern).

## §6 · The LOCK — full specification

**State machine:** `LOCKED` (v1 ships here; the only reachable state in v1 code) →
`UNLOCK_REQUESTED` (event emitted; anti-case generation starts) → `COOLING`
(≥3 company `day.closed` receipts must accumulate; wall-clock never consulted) →
`ARMED` — **unreachable in v1 by construction**: the transition function to ARMED
exists only as a stub that verifies a–e then returns BLOCKED + `incident.raised`,
red-team-proven. Shipping the verification logic WITHOUT the armed path means the
lock is real and testable while real orders remain impossible.

**Anti-case report (auto-generated during COOLING, mandatory citation):** worst
drawdown per surviving spec · luck-adjusted stats · divergence status ·
cost-of-curiosity meter · the sentence "paper survival is not evidence of
real-money survival" printed verbatim.

**Red-team scenario list (P2, ≥1 day):** each condition a–e removed → BLOCKED ·
system clock rolled forward/back · policy file symlink swap · policy edited by
script (heuristic: edit must be accompanied by Ashiq's `decision.recorded` — a
machine edit without one = incident) · caps left null → invalid → BLOCKED ·
same-day double-run cap race (caps summed from receipts, not per-run memory) ·
stub-broker "real" mode probe from playground zone · unlock.requested replayed/
duplicated (idempotency).

## §7 · Phase specs (appetite: 1 week build + 30 trading days background; A9 = hard cap)

### phase-00-spec — Isolation + specs + deterministic backtester (~2.5d)
**Objective:** the parser-class trio (spec parser, snapshot pipeline, backtester)
exists, adversarially hardened, before anything consumes it.
**Ckpt A (~1d) — skeleton + isolation:** instance layout · stream writer/reader
(canonical serialization) · isolation lint + creds-inventory check · `trader.policy.
yaml` schema + lint (deny-by-default local checker).
**Ckpt B (~1.5d) — data + engine:** spec schema + parser (**adversarial pass:
malformed YAML, oversize, unknown primitive, complexity breach, fuzz — holes fixed +
pinned BEFORE ckpt C of life continues**) · snapshot pipeline + sha receipts +
corporate-action config · backtester with no-lookahead convention + cost table +
walk-forward splitter · twin determinism in CI (delete derived state → replay →
byte-identical).
**DoD:** REQ-1/2/3 green · adversarial report committed. **Out of scope:** paper
loop, reports beyond raw numbers.

### phase-01-spec — Honesty battery (~1.5d)
Walk-forward report lint · attempt ledger (replay-derived) · null-monkey generator
(seeded) · baselines (buy-and-hold, cash) · regime tagger · verdict templates +
vocabulary lint (WIN-word lint included) · planted-overfit fixture strategy.
**DoD:** REQ-4 green — including the planted-overfit spec coming out
`INDISTINGUISHABLE-FROM-LUCK`. **Out of scope:** anything live.

### phase-02-spec — Paper loop + THE LOCK (~2d; red-team ≥1d of this)
**Ckpt A (~1d) — loop:** cron-mode daily runner + heartbeat receipts +
receipt-derived day count + missed-day incidents · daily/weekly brief wiring
(noise-budget goldens) · divergence metric + `MODEL-SUSPECT` flags · drawdown
breaker (fires in sim, fixture).
**Ckpt B (~1d) — lock:** state machine + conditions a–e verification + anti-case
generator + spine-clock cooldown + **full red-team pass over §6's scenario list**.
**DoD:** REQ-5/6/7 green + red-team report committed. **Out of scope:** any real
broker integration (forbidden in v1 anyway).

### phase-03-spec — First question cycle (background; 30 trading days elapsed; ~0.5d total effort)
One real research question end-to-end: question.opened → ≤3 registered specs →
slots + predictions → 30 trading days → verdicts + autopsies → answer published →
`/arc-retro` with the CONTINUE/DORMANT fork exercised for real.
**DoD:** REQ-8 green · honest verdict published · retro done · autonomy-evidence
bundle exported (the flight-simulator byproduct: breaker/caps/incident receipts for
future policy-engine promotion arguments).

**Cut order if the appetite blows (pre-agreed):** claim-debunking extras → regime
tagger (verdicts then carry `REGIME-UNTAGGED`) → prediction ledger → null-monkey
downgraded to baselines-only. **Never cut:** isolation, two-zone, attempt ledger,
verdict vocabulary, the lock.

## §8 · Fixture inventory (minimum pins; IDs assigned in-repo at kickoff)

**Spec parser (6):** malformed YAML · oversize · unknown primitive ·
complexity-budget breach · post-registration edit attempt · fuzz corpus.
**Data (6):** lookahead (same-bar-close trade) · gap days · duplicate bars · NaN ·
unadjusted split/dividend · timezone off-by-one.
**Honesty battery (6):** training-window eval → lint FAIL · min-trade underflow →
no verdict · attempt-count tamper (self-reported ≠ replay-derived) · WIN-word lint ·
planted-overfit → `INDISTINGUISHABLE-FROM-LUCK` · single-regime → tag.
**Determinism (2):** twin-run byte-diff · null-monkey seed reproducibility.
**Paper loop (4):** missed-day → incident + correct count · >⚙3 gaps → run invalid ·
breaker day → fires in sim · noise-budget golden.
**Divergence (2):** injected slippage shift → `MODEL-SUSPECT` · recalibration
lineage (new config sha, old reports untouched).
**Lock (9+):** the §6 red-team list, one fixture per scenario.

## §9 · Pre-mortem (top 5)

1. **Backtest overfit looks like alpha** → REQ-4 battery + TRD-G budget; the
   planted-overfit fixture keeps the battery itself honest.
2. **Excitement erodes the lock** → spine-clock 72h + anti-case citation +
   condition (e) + E2; red-team fixtures attack the erosion paths explicitly.
3. **Sandbox eats serious build time** → A9 cap + pre-agreed cut order +
   background-elapsed design + terminal state + cost visibility when ledger lands.
4. **Data source dies or drifts mid-run** → snapshots archived + sha'd; secondary
   source named at kickoff; divergence law catches silent feed changes.
5. **Windows cron fragility fakes a clean month** → heartbeat receipts +
   receipt-derived day count + missed-day incidents; a silent gap cannot present
   as a clean run.

## §10 · Non-negotiables / no-gos (consolidated)

E2 absolute (Constitution LAW since 2026-08-06) — real-money unlock is never a
phase of any plan · no real-order
code paths in v1 (stub broker only; broker creds must not exist) · no strategy
marketplace / copy-trading / signals · no leverage modeling v1 · no crypto-degen
presets · no ML/hyperparameter strategy search v1 (an overfit factory that defeats
the attempt ledger's spirit) · no intraday/tick ambitions v1 · no live HTML
dashboard (text reports; the dashboard module consumes the reader later) · costs
pessimistic always · verdict reporting Truth-Law honest · playground output can
never be quoted as evidence · LLMs never in the compute path.

## §11 · Kickoff gates + open decisions (deliberately few)

**Pre-kickoff gates (verify, else STOP):** the Build-out-Mandate `decision.recorded`
receipt cited in the kickoff ADRs · live slot free (A9) · ADR century claimed per
`PORTFOLIO.md` · data source vetted via `/arc-capability` (installs nothing).

**Open decisions:**

1. Final instrument confirmation (reco: NIFTY-tracking index ETF, EOD).
2. Data source + named fallback via `/arc-capability`.
3. ⚙ values: min-trade floor 30 · slots 3 · registrations 5/month · null-monkey
   population 100 · divergence band · gap tolerance 3 · complexity budget 4 ·
   drawdown breaker 15% · regime thresholds — all kickoff-tunable.
4. Trader-stream kind set final wording (§5.7).
5. Lane century assignment (next free band at birth).

## §12 · Deviations from BRIEF-trader (on the record)

1. **Trigger converted under the owner's Build-out Mandate (2026-08-09 — same
   `decision.recorded` as strategy-README correction #15, cited by the kickoff
   ADRs; A8's letter kept):** the brief's double-gate ("stable monthly revenue AND
   written opening") no longer gates the build — dependency sequencing replaces it
   (§1). Honesty note: no revenue receipt exists and none is invented; unlike the
   other mandate conversions there is NO deferred revenue milestone here — income
   is permanently outside this module's claims. The *spirit* of the written-opening
   leg survives as the kickoff approval itself. And the LOCK — the part that
   actually guards money — is **strengthened**, not relaxed (4→5 conditions,
   spine-clock, anti-case).
2. Hard prereqs (policy engine, ledger) relaxed into the graceful-degradation table
   (§1) with equivalence-fixture migration obligations.
3. Council gate → non-blocking prediction ledger (round-3 friction ruling).
4. REQs expanded 5 → 8 (two-zone, honesty battery, divergence, lifecycle honesty).
5. Lock conditions 4 → 5 (compliance review) + spine-clock + anti-case.
6. Appetite unchanged (1 week) with an explicit pre-agreed cut order.
7. 30-day run redefined measurably (scheduled trading days, receipt-derived count).

## §13 · Rejected registry (so future sessions do not relitigate)

R-01 trader inside the HQ instance — isolation unprovable. R-02 registration
required for all runs — kills play. R-03 formula DSL in specs — unfalsifiable
complexity + injection surface. R-04 arbitrary code strategies — same, worse.
R-05 multi-instrument v1 — scope creep, zero epistemic gain. R-06 intraday/tick v1
— data cost + microstructure lies. R-07 crypto v1 — degen-preset no-go + India
tax/compliance noise. R-08 hypothesis budget on playground — anti-creativity.
R-09 mandatory council gate per strategy — ceremony kills usage. R-10 calendar-day
run definition — holidays fake gaps. R-11 wall-clock cooldown — clock tampering.
R-12 "WINS" verdict state — E3 vocabulary violation. R-13 ML strategy search v1 —
overfit factory. R-14 LLM in the compute path — nondeterminism + cost.
R-15 real-broker sandbox API in v1 — creds existence risk for zero epistemic gain.
R-16 self-reported attempt counters — tamperable; replay-derived only.
R-17 leverage modeling v1 — risk realism can wait; honesty cannot.

## §14 · Landing record (drop executed 2026-08-10, disk-only — git untouched)

Owner-approved drop ("repo la podu", structure rules followed). Files touched:

1. `docs/strategy/plans/PLAN-trader.md` — this file, NEW (placement: `plans/`,
   because it feeds `/arc-kickoff` — kickoff-grade REQs, locked TRD letters,
   phases, paste-ready prompt at the bottom).
2. `docs/strategy/plans/README.md` — trader row flipped BRIEF → PLAN (trigger
   converted under the Build-out Mandate; sequenced-last-by-dependency wording);
   PLAN count 19 → 20.
3. `docs/strategy/README.md` — file map updated (20 PLANs + 3 BRIEFs), moved-row
   added for the brief, correction **#22** appended (dated 2026-08-10).
4. `docs/strategy/plans/BRIEF-trader.md` → `docs/archive/BRIEF-trader.md`
   (superseded — never feed the brief to a kickoff).

Remaining (owner, his git workflow): feat branch → commit the 4 paths → PR → merge.
The machine committed nothing.

## Appendix A · Adjudication log (compressed)

**Round 1 (8 holes):** revenue-definition · scheduler gap · prereq-deadlock ·
lane-native prompt · missing baseline REQ · data reality (sha / corporate actions /
India costs / archival) · compliance condition (e) · 30-day definition + scope pin.
All absorbed; hole 1 mooted by the doctrine pivot (recorded §12.1).
**Round 2 (12 ideas):** pre-registration + attempt ledger + luck adjustment ✓ ·
autonomy-crash-test reframe ✓ (§0) · null-monkey + no-WIN ✓ · spine-clock +
anti-case ✓ · divergence-as-north ✓ · council gym ✓ (as prediction ledger) ·
cost-of-curiosity ✓ (degrades until ledger) · ladder + slots ✓ · regime tag ✓ ·
hypothesis budget ✓ (confirmatory-only) · terminal state ✓ · build-in-public
byproduct — noted, ship-with only, owner-published, never a REQ.
**Round 3 (friction audit):** two-zone law added · budget scoped to lab · council
gate → predictions · registration = 2-second command · slots/thresholds → config ·
principle locked: *automate the honesty, never bureaucratize the curiosity.*

## Appendix B · Kickoff prompt (paste-ready, lane-native)

```
/arc-kickoff trader sandbox — isolated paper-trading research lab --lane trader
Design source: docs/strategy/plans/PLAN-trader.md v1.1 (decisions TRD-A..M locked;
REQ-1..8; the brief's revenue trigger is CONVERTED under the owner's Build-out
Mandate, 2026-08-09 — cite that decision.recorded in the kickoff ADRs; deviations
in section 12). Verify gates first, else STOP: mandate receipt · live slot free
(A9) · claim the next free ADR century per PORTFOLIO.md · data source vetted via
/arc-capability. Appetite: 1 week build + 30 trading days background; cut order in
section 7. Non-negotiable: isolation (REQ-1), two-zone law (REQ-2), honest-report
battery (REQ-4), and THE LOCK (REQ-7: conditions a-e, spine-receipt 72h cooldown
never wall-clock, red-team >= 1 day). E2 (Constitution LAW): real-money unlock is
NOT part of this or any plan — v1 ships with no real-order code path and no broker
creds. STOP after PLAN.md + phase specs for my approval.
```

— end of PLAN-trader v1.1 FULL —
