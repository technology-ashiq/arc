# ADR 1629 — hire-to-own is one command (`org-own.mjs`) over `agent-scaffold`'s proposal writer

**Status:** accepted
**Date:** 2026-10-05
**Product:** `org`
**Reversibility:** two-way

## Context
ORG-R item 4 (ADR-1618): a `hired` seat (ADR-1614: enters through `arc-run`'s router) is rewritten into an
`own` agent by hand today — `/arc-absorb` plus `agent-scaffold.mjs`. The command was to be earned after the
second manual rewrite; the owner ruled on 2026-10-05 to build it now. `agent-scaffold.mjs` already computes
the four files a new agent needs from main's own bytes and lands them through `core/proposal-branch.mjs`.

## Options considered
1. **Extend `agent-scaffold.mjs` with an `--own-role` flag**: one script with two jobs and two receipt shapes.
2. **`.claude/scripts/org/org-own.mjs --role ROLE --name AGENT --description TEXT --tools LIST`** that imports
   `agent-scaffold`'s planner and adds the card change to the SAME proposal (REQ-09).

## Decision
Option 2. It refuses unless the card's `origin` is `hired` and `hire` is non-null; the new agent name is
free; the tier is read from the card's `binds.tier` (never typed). The proposal holds the scaffold's files plus
the card rewritten: `origin: own`, `hire: null`, the new agent first in `binds.agents`, and one `history:`
line naming the hire it replaced. Then one `approval.requested`. The router row of the old hire is NOT
removed by the command — retiring a hire is a tier-shaped change ADR-0069 b1 puts in a reviewed diff.

## Consequences
Easier: the rewrite is one reviewable branch. Harder: `org-own` depends on `agent-scaffold`'s exported
planner shape; a change there must keep `org-own`'s fixture green.
