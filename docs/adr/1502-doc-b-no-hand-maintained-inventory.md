# ADR 1502 — DOC-B: no hand-maintained inventory of what exists

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way

## Context

Locked in the design source (DOC-B). The face lane keeps `expected-set.json`, a hand-edited map of
what exists to where it renders; every new lane must remember to add itself there. The wiki's
whole promise is that nobody has to remember.

## Options considered

1. **A nav / contract JSON the wiki reads** — one more file to forget; it lies the week someone does.
2. **Every list derived at build time from `treeWorld`** — nothing to forget.

## Decision

Option 2. No JSON contract, no nav file, no README table of entities anywhere under `docs/wiki/`
or `.claude/scripts/docs/`. The index page is generated from `wiki.json` like every other page.
*A number nobody recomputes is a number that starts lying* (retro 2026-07-22).

## Consequences

The wiki cannot carry editorial grouping a human would choose; grouping is by entity type only.
Narrative files (ADR-1505) are keyed by entity id, and an id that no longer exists is an orphan the
coverage gate names (ADR-1503), so they cannot become a second inventory.
