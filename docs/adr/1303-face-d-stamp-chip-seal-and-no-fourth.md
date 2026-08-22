# ADR 1303 — FACE-D: three affordance classes — Stamp · Chip · Seal — and no fourth

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** a needs-you kind appears that genuinely cannot be expressed as a
stamp card, a command chip, or a seal — it gets a new ADR before any component ships.

## Context

Every affordance in the face must be honest about what a human may do (E2). Pre-mortem
row 3: write paths multiply one button at a time unless the class system is enforced by a
machine.

## Options considered

1. **Three classes enforced by a registry lint** — every interactive component is a Stamp
   (the one write), a Chip (run-this-yourself CLI, copyable, never executed), or a Seal
   (forever-human, lock + the article/ADR quoted). Pros: lintable; the mutant-button
   fixture is the negative control. Cons: some flows feel slower than a button would.
2. **Case-by-case UX judgment** — cons: exactly how "approve all" ships.

## Decision

Option 1. A lint over the L3 component registry forbids any `onClick` that calls a
non-`/api/decide` mutation; the fixture manifest's mutant (a button calling `/api/emit`)
must FAIL the lint — the mutant IS the negative control. The lint starts **WARN-first**
in the trial set, gets attacked by a fresh agent, then earns FAIL through the trial ledger
(A1). The stamp animation is the one piece of expressive motion in the product; seals
render beside every stamp station and room header (the five E2 ungrantables verbatim, plus
the per-room "NEVER a button" list).

## Consequences

Easier: "what can this screen do to the company" is answerable by grep; design reviews
argue placement, not power. Harder: every new panel must declare its class up front —
which is the point.
