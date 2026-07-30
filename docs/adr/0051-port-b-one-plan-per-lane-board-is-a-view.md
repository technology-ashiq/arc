# ADR 0051 — PORT-B: one live plan per lane; PORTFOLIO.md is a view, never the truth

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

Generalizing the One Rule ("exactly ONE plan is ever live") to many lanes needs a single
answer to "what is live company-wide" without creating a second source of truth. Source
pack: `docs/strategy/plans/PLAN-portfolio.md` §3.2, §4, §5 PORT-B (review rounds 2–5).

## Options considered

- Root `PORTFOLIO.md` board as a derived VIEW with a strict lint-parsed markdown grammar.
- Companion `portfolio.yaml`/`.json` — rejected (§14): a second file is a second source
  of truth; richer automation later reads the SPINE (receipts are the API, ADR-0027).
- Auto-generated board from the spine, now — rejected (§14): automation before the manual
  process proves itself.

## Decision

Exactly one plan is ever live **per lane**; `PORTFOLIO.md` is the single company index +
priority view. Truth hierarchy (one source of truth per question):

- `initiatives/<lane>/PROGRESS.md` = operational truth (where the work is)
- `initiatives/<lane>/PLAN.md` = scope truth (what the cycle is)
- `PORTFOLIO.md` = index + priority VIEW — on any mismatch the lane files win and the
  board lint flags the drift
- `docs/HISTORY.md` = immutable company log (lane-tagged entries)

Two tables: **Active initiatives** (strict row grammar; every row ↔ `initiatives/<lane>/`
dir, lint-checked) and **Venture passports** (grammar-checked, no dir lint). Board
mutation happens in the SAME tracker-update commit of kickoff / phase-done / retro.
Board values derive from each lane's PROGRESS **machine header block** (status / cycle /
phase / appetite / burn / blocked-on / depends-on) — the single computed-from source;
nothing hand-copied from prose. `Updated: YYYY-MM-DD` fact line; row order = priority;
no ETA, health, priority, or owner fields (computed-or-earned rule).

## Consequences

- Divergence between board and lane headers is a WARN, never a second truth.
- The old One-Rule text in docs is rewritten in Phase 3 (docs flip last, same cycle).
- Dependency cells use the standard parseable convention:
  `blocked-on: <lane|owner|external> — <reason>` · `depends-on: <lane> — <what>`.
