# ADR 0050 — PORT-A: lanes live at `initiatives/<product>/`

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

arc's law today is one live plan at the root (`PLAN.md` + `PROGRESS.md` + `phases/`): a
single parking slot, so one blocked lane stops the whole company (measured: design P03
parked on owner items while develop sat kickoff-ready). Multi-lane workspaces need a home
directory. Source pack: `docs/strategy/plans/PLAN-portfolio.md` §5 PORT-A,
**owner-locked 2026-07-29 (round 2)**.

## Options considered

- `initiatives/<product>/` — "initiative" is already arc's own word for a build cycle;
  no collision with existing dirs.
- `lanes/<product>/` — matches the operational word, but "lane" stays the *flag* word
  (`--lane`), not the folder.
- `products/<product>/tracker/` — collides head-on with the module-manifest registry
  (`products/<name>/manifest.json` = code ownership, never tracker state).
- One repo per product — rejected (§14): kills the one-machine / one-main / one-CI /
  one-spine integration guarantee; that split is for VENTURES.

## Decision

Lanes live at `initiatives/<product>/`, kebab-case names matching `[a-z][a-z0-9-]*`
(starts with a letter, validated at creation). Each lane holds that product's PLAN.md,
PROGRESS.md, phases/, evidence/, docs/, archive/. `products/` stays the module-manifest
registry, untouched. A later `products/` → `modules/` rename is a separate ADR, not this
cycle.

## Consequences

- A folder move can undo this (two-way), so long as no history is rewritten.
- The vocabulary table (PLAN §1) locks the words: initiative/lane = workspace, module =
  body, company layer = single, venture = own repo.
- Empty lanes are never pre-scaffolded; a lane is born only by `/arc-kickoff` (ADR 0054).
