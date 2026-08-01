# HISTORY.md — the company logbook

> One page answering **"what has arc actually done so far?"** Append-only, newest first:
> one entry per closed (or parked) initiative, written at `/arc-retro` when the cycle
> closes. This file is a **derived view** (Constitution A5) — the truth lives in
> `docs/archive/` bundles, `docs/evidence/`, `CHANGELOG.md`, and (from Cycle-2 on) the
> receipt spine. Numbers are copied verbatim from the retro stat line, never recomputed.
>
> ⚠ Wiring TODO (Phase-04 retro item): add an "append HISTORY entry" step to the
> `/arc-retro` checklist so this page maintains itself from now on.

## At a glance

| # | Initiative | Dates | Result | Burn | Shipped |
|---|---|---|---|---|---|
| C4 | arc-portfolio "The Conductor" | 2026-07-30 → 2026-08-02 | **CLOSED — 4/4 phases** | ~112% of 3d | lanes + resolver on 7 surfaces · `PORTFOLIO.md` board + board lint · ownership lint · WIP info line · per-lane One Rule (ADR-0050..0062) |
| C3 | arc-design "The Designer" | → 2026-07-30 | **CLOSED — 4/4 phases** | ~60% | vision-based design review: read-only critic · four-contract brief · thesis-driven exploration + blind ranking |
| C2 | Receipt Spine | 2026-07-22 → live | **LIVE — Phase 04 dogfood** | ~40% of 12.5d (P00–03) | spine core · 7 flows emit · daily brief · approval inbox · reader-only API (ADR-0024..0031) |
| C1 | Orchestrator (product monorepo) | → 2026-07-22 | **CLOSED — 6/6 phases** | ~22% | 6 installable products · selective install + per-target registry · scripts re-homed · EVENT.d dispatcher · 22 commands · bats 271→334+ |
| — | v2 "world-best" quality engine | → 2026-07-17 | **PARKED (ADR-0017)** | — | arc-scan steel thread (semgrep+gitleaks → SARIF) · strictness profiles · block-by-default gates — banked, not killed |

## Milestone tracker

| Milestone | Status |
|---|---|
| Two real consumer repos installed (venturemind · Opportunity-Scout) | ✅ Cycle-1 era |
| Company runs on receipts (spine live on real work) | ✅ 2026-07-24 — dogfood day 1+ |
| Constitution adopted (first `constitution.adopted` event) | ⏳ pending — Phase-04 retro |
| Venture chosen for Cycle-3 | ⏳ pending — decision overdue |
| First real ₹ (`revenue.received`) | ⏳ target Sep 2026 |

## Entries (newest first)

### C4 · arc-portfolio "The Conductor" — CLOSED 2026-08-02 · lane `portfolio`

- **Kickoff:** 2026-07-30 · design source `docs/strategy/plans/PLAN-portfolio.md` · appetite 3d Tier S
- **4/4 phases CLOSED:** 00 dual-mode machinery · 01 self-host + link history + board v1 · 02 parallel-safety floor · 03 docs truth + retro
- **Stat line (verbatim):** S | rework 1/4 | amendments 9 | FIRED 1/5 | burn ~112% | sim-blockers-r1 n/a-tier-S | t-to-phase0 1d
- **Shipped:** `initiatives/<lane>/` lanes + resolver on 7 surfaces (root-mode byte-identical, a permanent consumer contract) · `PORTFOLIO.md` board + strict-grammar board lint · ownership lint · WIP info line · the per-lane One Rule in the five docs that teach it
- **Mode B NOT certified** — granted for three hours on 2026-08-01 and withdrawn at Phase 02's close when section F's spool was reverted; ADR-0056 makes certification a fixture result, so removing the fixture removes the certification
- **Decisions:** ADR-0050..0062 (PORT-A..J, plus the three mid-cycle settlements 0060, 0061, 0062)
- **First cycle to finish over appetite:** 3d declared, ~3.35d actual. `appetite-sum` warned every run that 100% allocation left zero slack; Phase 02 overran 0.35d and there was nothing to absorb it. The gate was right, and this is the first firing on arc's own plan the outcome confirms.
- Full record: `initiatives/portfolio/` (PLAN · PROGRESS · phases) + `initiatives/portfolio/evidence/phase-0*`

### C3 · arc-design "The Designer" — CLOSED 2026-07-30 · lane `design`

- **Back-filled at Cycle 4's retro (2026-08-02).** The cycle closed with a retro stat line and an archive bundle but never got its entry here — precisely the wiring gap this page's own ⚠ TODO names. Recorded late rather than left missing: a company log with a hole cannot also be the truth hierarchy's immutable log.
- **Stat line (verbatim):** M | rework 0/4 | amendments 12 | FIRED 3/7 | burn ~60% | sim-blockers-r1 not-recorded | t-to-phase0 ~0.6d
- **Shipped:** vision-based design review that judges rendered pixels rather than reports about them — read-only critic, four-contract brief, thesis-driven exploration with blind ranking
- Full record: `docs/archive/PLAN-2026-07-30.md` · `docs/archive/PROGRESS-2026-07-30.md` · `docs/archive/phases-design-2026-07-30/` · index at `initiatives/design/HISTORY-INDEX.md`

### C2 · Receipt Spine — LIVE (entry finalizes at retro)

- **Kickoff:** 2026-07-22 · design source `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md` · appetite 2.5w Tier M
- **Phases 00–03 CLOSED** well under appetite (~40% burn): 00 spine core (25 adversarial holes fixed) · 01 factory wiring (7 flows emit, ~2s overhead → async) · 02 money+brief (REQ-08 cost CUT — owner's call) · 03 inbox + API seal (W8 cursor-store cut)
- **Phase 04 live dogfood** started 2026-07-24, host = arc itself · day 1: brief 10 lines / 306 ms, 22 real receipts
- **Decisions:** ADR-0024..0031 (SPINE-A..H) · revenue stays `revenue.simulated` until a venture ships
- Full record: root `PLAN.md` + `PROGRESS.md` + `docs/evidence/phase-0*` (moves to archive at close)

### C1 · Orchestrator — CLOSED 2026-07-22

- **Goal:** turn arc into a manifest-driven product monorepo with physical boundaries
- **Result:** 6/6 phases · ~22% burn · rework 1/6 · 10 amendments · 1/8 gates FIRED
- **Shipped:** 6 products (core/plan/review/qa/git/council) · selective install (`--products`) + per-target `arc-registry.json` · scripts re-homed to `.claude/scripts/<product>/` · EVENT.d hook dispatcher · 22 commands · bats 271→334+
- **Decisions this era:** ADR-0014..0023 (incl. 0021 tests stay centralised · 0022 InvoiceFly does not exist · 0023 attic ≠ ownership)
- Full record: `docs/archive/PLAN-2026-07-22.md` · `docs/archive/evidence-orchestrator-2026-07-22/` · stat line in `docs/retro-log.md`

### v2 "world-best" quality engine — PARKED 2026-07-17 (ADR-0017)

- **What it was:** the pre-cycle-numbering initiative for a world-best quality engine — arc-scan pipeline (diff-scope → semgrep/gitleaks adapters → minimal-SARIF merge → triage), strictness profiles (`starter`/`standard`/`strict`), block-by-default gates (ADR-0008); phases 00–01 landed per `CHANGELOG.md` [Unreleased]
- **Why parked:** deliberate scope call, not failure — banked per A10; learnings fed ADR-0018 (incremental rehoming) and the orchestrator initiative
- Full record: `docs/archive/PLAN-2026-07-17.md` · `docs/archive/phases-v2-2026-07-17/`

## Rules

1. Append at `/arc-retro`, never mid-cycle (the live row may only flip status).
2. One entry per initiative, ~8 lines max; numbers from the retro stat line verbatim.
3. Always link the archive bundle — this page never duplicates evidence (A5).
