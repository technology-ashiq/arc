# ADR 1606 — ORG-F: eight lifecycle stages with receipt-measured exit criteria; only an owner decision moves a stage

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** A stage's exit criterion cannot be expressed over existing kinds -> that criterion is marked `manual` on the manifest and named in retro.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-F). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Eight stages** `discover → validate → build → launch → grow → sell → support → operate`, each with `on_shift` roles and a spine-checkable exit criterion.
2. **Free-form stages per venture** — flexible, but the dispatcher has nothing deterministic to read.

## Decision
Eight stages. The dispatcher may *propose* a stage change when the criterion reads true; only an owner `decision.recorded` moves it. Stages overlap via `on_shift`, not a waterfall.

## Consequences
Easier: deterministic dispatch. Harder: criteria for later stages stay untested until a venture reaches them.
