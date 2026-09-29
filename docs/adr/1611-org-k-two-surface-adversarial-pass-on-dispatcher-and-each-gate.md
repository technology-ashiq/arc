# ADR 1611 — ORG-K: every gate and the dispatcher get a two-surface adversarial pass by fresh agents

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** An attack round cannot run (model 503/429) -> the gap is recorded in the phase bundle, as docs Phase 00 did; never silently skipped.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-K) and CLAUDE.md: two fresh agents with different surfaces; the author cannot be the attacker. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **`/arc-attack`**, logic surface + boundary surface, lane fixed-defects list in the prompt, max two rounds per PR.
2. **One generalist** — structural blind spot.

## Decision
`/arc-attack` on each gate (`org-coverage`, team digest, sync `--team`) and the dispatcher: one agent on decision logic (stage criteria, scorecard math, vacancy counter, budget arithmetic), one on the filesystem / spine / policy boundary. Neither may be the author.

## Consequences
Easier: holes found before CI. Harder: token cost, capped at two rounds per PR.
