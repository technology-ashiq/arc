# ADR 0040 — DES-H: REQ-01 requires two separate external blind evidence streams, both passing

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** one-way
**Revisit trigger:** recruiting either stream proves impossible at ₹0 within the ADR-0041 window (14 days after Phase-3 build-complete) — then the evidence standard itself comes back to the owner, never silently weakens.

## Context

"World-class designer" claimed by arc about arc is not evidence. Superseded row 9 killed
the single mixed external panel: designers and users answer different questions.

## Options considered

1. **Two separate blind streams** — Stream A: experienced designers judge coherence/distinctiveness/feasibility/craft (PASS = ≥2 of 3 directions taken seriously); Stream B: target users attempt the key task (PASS = completion without intervention). Arc origin undisclosed; two SEPARATE evidence files; both must pass. Con: recruiting effort, elapsed calendar time.
2. **One mixed panel** — half the recruiting. Con: conflates craft judgment with usability evidence; each contaminates the other.
3. **Internal evaluation only** — free, instant. Con: arc judging arc ≠ proof.

## Decision

Option 1. A peer's "looks good" never counts as user validation; a user completing a task
never counts as craft evaluation.

## Consequences

Easier: the "world-best" claim has a falsifiable form. Harder: REQ-01 validation depends
on people outside arc's control — which is the point. Timing governed by ADR-0041
(evidence may trail the build; REQ-01 stays `active` until both streams pass).
