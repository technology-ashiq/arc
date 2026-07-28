# ADR 0045 — Phase-0 steel-thread target = `docs/strategy/arc-hq-mockup.html` (arc-internal), not LexOS

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** the mockup page proves too trivial to exercise the critique protocol (fewer than 3 distinct findings possible) → swap to a venturemind route, same phase.

## Context

Auto-decided two-way door (kickoff step 2b — never a user question). Phase 0 needs ONE
real route to prove critic vision + read-only enforcement + receipt + warn gate. LexOS is
explicitly the Phase-3 pilot; Phase 0 must not depend on another repo.

## Options considered

1. **`docs/strategy/arc-hq-mockup.html`** — real arc-internal page, in-repo, renders deterministically as a static file via agent-browser, no dev server. Con: static, not an app flow.
2. **A LexOS route** — real product. Con: cross-repo dependency in the steel thread; LexOS is Phase 3 by plan.
3. **A synthetic fixture page** — fully controlled. Con: "real route" requirement dies; fixture pages are for the planted-defect *test*, not the demo target.

## Decision

Option 1. The planted-defect variant of the same page (committed fixture) serves the red
test; the real page serves the live demo.

## Consequences

Easier: Phase 0 is self-contained and deterministic. Harder: no interactive states on a
static page — full task-flow coverage waits for Phase 2/3 surfaces, which is the plan.
