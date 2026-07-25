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
