# Phase 03 — Docs truth + retro

**Goal (one line):** Flip the docs last, same cycle (REQ-05): One Rule rewritten to per-lane law quoting PORTFOLIO.md as the index view (ADR-0051), vocabulary table + truth hierarchy into how-arc-works-simple §1/§3/§8 + usermanual + plans/README ritual, ADR template gains a one-line `Product:` field (ADR-0053), HISTORY entry logged, `/arc-retro` run.

**Appetite:** 0.25 days
**Depends on:** phase-02

## Verification plan

- Coarse (refined via `/arc-change` when the phase starts): `/arc-docs` drift gate passes with 0 findings; retro run; board shows portfolio IDLE with a `last:` note and develop kickoff as the queued next.

## Rabbit holes in this phase

- Rewriting docs beyond the sections REQ-05 names. Retro scope creep — findings route
  through the normal retro promotion path.

## Out of scope for this phase

- Any code change. The develop kickoff itself (next cycle, first native lane).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).
