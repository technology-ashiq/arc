# PLAN (design source) — discover v1: the idea engine

> **Trigger (pull):** ready to pick the next venture (portfolio needs a new bet) — OR
> Cycle-3's venture slot needed option-3 (new venture from a hunt). **Prerequisites:**
> spine live (verdicts/approvals land as events) · council module working (it already is).
> **Note:** if Opportunity-Scout's existing function overlaps pain/opportunity scanning,
> Phase 0 MUST audit it first — extend it rather than duplicate it (Constitution A5).

## Goal

One sentence: `/arc-hunt <niche>` turns raw complaint streams into a **scored, evidenced,
deduped shortlist** that council judges and Ashiq approves — so "what to build next" stops
being vibes and becomes the first receipted step of every venture.

## Current state (as of 2026-07-22 — re-verify at kickoff)

- council module live with jurors + `council-calibrate.mjs` (calibration seed exists);
  session 001 on record.
- Spine expected live: `idea.captured`, `council.verdict`, `approval.requested` are already
  in the 18-kind vocabulary — discover emits, doesn't invent kinds.
- Opportunity-Scout repo exists (function to audit at Phase 0).
- Nothing exists of: miners, scoring, `/arc-hunt`.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | Raw pain becomes structured evidence | Miner v1 (ONE source: Reddit public JSON) pulls N posts for a niche query → normalized records (source-url, text, engagement, ts); malformed/hostile inputs (deleted posts, injection strings in titles, huge bodies, non-UTF8) handled — fixtures pinned, adversarial pass done | 0 |
| REQ-02 | No duplicate ideas, ever | Same post fetched twice (or across runs) → one `idea.captured` (spine idem discipline reused); near-duplicate posts cluster together (token-overlap v1 — NO embeddings); cluster membership deterministic: same input → identical clusters | 0 |
| REQ-03 | Scoring is explicit and tunable | `score.yaml` weights: pain-frequency · money-signal (pricing/“I'd pay”/existing-tool complaints) · buildability-in-2-weeks · moat-hint; every score traces to its evidence lines (no black box); re-run with same input → identical scores | 1 |
| REQ-04 | Council judges, calibration fuels | Top-2 clusters get council sessions: verdict + confidence + predicted-90-day-outcome recorded as `council.verdict` events — the prediction field is what evolve/calibration consumes later | 1 |
| REQ-05 | The human gate is a receipt | Winner → `approval.requested` in the inbox; Ashiq approve/reject with reason → `decision.recorded`; an approved idea exports a **kickoff-ready one-pager** (problem, evidence links, ICP guess, wedge, 2-week scope sketch) | 2 |
| REQ-06 | It ran for real | One real hunt on a real niche end-to-end (mine → cluster → score → council → decision), evidence bundle committed; time-to-shortlist < 1 hour wall clock | 2 |

## Appetite

**1.5 weeks hard cap.** Tier: S/M.
**Kill criteria:** Reddit access blocked/ToS-changed beyond a day of workarounds → switch
source to HN Algolia API (public, stable) and continue — the pipeline is the product, not
the source. Clustering quality garbage after 2 days → ship frequency-sort without clusters
(bank), note clustering as demand-triggered.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| DIS-A | Source adapter interface: `miners/NAME.sh <query> → NDJSON records` — one contract, sources swappable; Reddit JSON first, HN Algolia as the pinned fallback |
| DIS-B | v1 clustering = deterministic token-overlap (zero-dep); embeddings only via engine driver later (pull-trigger: precision demonstrably insufficient on real hunts) |
| DIS-C | Scores live in `score.yaml` (weights human-owned); evolve may PROPOSE weight diffs later, never apply |
| DIS-D | Rate-limit + robots respect: polite fetch (1 req/sec, UA identified, public JSON endpoints only, no login-walled scraping) — reputation is a company asset (Constitution E3 adjacent) |

## Non-negotiables

- Miner/normalizer/clusterer are parser-class (hostile web input!) → adversarial pass +
  pinned red fixtures before FAIL promotion. Injection strings from post titles must never
  reach shell/eval contexts — fixture-proven.
- All events via the standard emitter; discover reads the spine only through the reader
  (SPINE-G); `consumes:` declared in its manifest.
- Deterministic pipeline: same input snapshot → identical output (cluster, scores, order).
- Evidence links preserved end-to-end — a score without clickable sources is invalid.
- Zero-dep; central tests/ per ADR-0021; module layout: `products/discover/manifest.json`
  + `.claude/scripts/discover/` + `/arc-hunt` command (new command — note surface change
  in PLAN and CHANGELOG).

## No-gos

- No auto-build of winners (human approval → separate kickoff, always).
- No multi-source v1 · no embeddings v1 · no scheduler (hunts are human-started) ·
- No sentiment ML · no trend-velocity math v1 · no scraping behind logins, ever.
- No storing full post bodies beyond what evidence needs (trim; link is the record).

## Rabbit holes

Source tourism (one source + one fallback, full stop) · clustering literature (token
overlap, move on) · score-weight perfectionism (weights are a yaml edit, iterate on real
hunts) · building a UI (shortlist is markdown; the inbox is the UI).

## Pre-mortem (top 4)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Hostile web input breaks the pipeline or worse (injection) | Parser-class treatment: fixtures for injection/huge/malformed; no shell interpolation of scraped text |
| 2 | Shortlists are plausible-but-generic slop | Evidence-link non-negotiable + money-signal weight + council's skeptic juror; REQ-06 uses a REAL niche judged by Ashiq |
| 3 | Source access breaks (API/ToS shifts) | DIS-A adapter contract + HN fallback pinned; kill criteria pre-authorize the switch |
| 4 | Duplicates re-litigated every run | REQ-02 idem discipline + cross-run dedupe test |

## Phases

| Phase | Capability | Appetite |
|---|---|---|
| 0 | Opportunity-Scout audit (extend-vs-build memo) · miner v1 + normalizer + hostile fixtures + adversarial pass · dedupe/cluster deterministic | 3d |
| 1 | Scoring (`score.yaml`, evidence-traced) · council wiring (verdict + prediction events) | 2.5d |
| 2 | Inbox handoff (`approval.requested` → decision) · kickoff one-pager export · REAL hunt end-to-end + evidence bundle · retro | 2d |

**North-star:** time from "niche named" → "council-judged, evidence-linked shortlist in
the inbox" < 1 hour; and the first approved idea becoming a venture kickoff without any
manual re-research.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after the trigger fires)

```
/arc-kickoff discover v1 — the idea engine

Design source: docs/strategy/plans/PLAN-discover.md (approved; trigger: <state it>).
Read it fully. Phase 0 starts with the Opportunity-Scout audit — if it already covers
mining/scanning, propose extend-not-duplicate and STOP for my call. Decisions DIS-A..D
locked; assign next free ADR numbers. Injection-safety fixtures are non-negotiable.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```
