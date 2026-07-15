# ADR 0005 — Deep runs auto-save the verdict; quick runs stay ephemeral

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** the `sessions/` folder fills with low-value quick-take records, or users want an explicit opt-out from saving a deep run.

## Context
Should a council verdict be written to `docs/council/sessions/` by default, only on an explicit flag, or
never? Auto-saving builds a durable decision log; saving everything (including throwaway quick takes)
creates clutter and a future migration/backfill question.

## Options considered
1. **Never save (chat only)** — pros: zero on-disk state; cons: no decision log; can't revisit a past verdict.
2. **Save everything** — pros: complete log; cons: quick throwaway runs clutter the folder.
3. **Save deep runs only** — pros: durable log of substantive decisions, quick stays ephemeral; reuses the existing quick/deep boundary (ADR-0002), no new flag; cons: a good quick take isn't recorded (user can re-run deep).

## Decision
Option 3. A **deep** run (the default) auto-saves `docs/council/sessions/NNN-<slug>.md` with the full
verdict; a `quick` run prints to chat and writes nothing. Chosen because the quick/deep split is already
the natural save boundary and needs no extra flag.

## Consequences
Easier: a clean, substantive decision log accumulates automatically. Harder: quick takes vanish after the
turn — acceptable, and re-runnable as deep.
