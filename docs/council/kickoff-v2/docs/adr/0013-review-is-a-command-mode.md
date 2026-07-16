# ADR 0013 — `review` is a mode keyword of /arc-council, not a separate command

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** (optional) the review flow outgrows ~a screen of protocol text inside `arc-council.md`, or a consumer wants review without the council installed.

## Context
The outcome-review flow (`/arc-council review`: list overdue sessions → ask what happened →
append OUTCOME → render calibration table) needs a home: a mode inside the existing command (the
`quick` precedent) or a new `.claude/commands/` file. Two-way door — a mode can be extracted into
a command later by cut-and-paste — so auto-decided per kickoff protocol.

## Options considered
1. **Mode keyword inside `arc-council.md`** (like `quick`) — pros: one command surface, shares the verdict-contract context it depends on, mirrors the shipped idiom users already know; cons: the command file grows.
2. **Separate `arc-council-review.md` command** — pros: smaller files; cons: second command to discover/sync/lint, duplicated contract context, breaks the "one command, one council" surface.

## Decision
Option 1: `$ARGUMENTS` beginning with `review` enters review mode, exactly parallel to the shipped
`quick` mode. The carrying reason: consistency with the established mode idiom keeps the user
surface at one command.

## Consequences
Easier: discovery ("everything council is /arc-council"), sync wiring unchanged, static lint keeps
checking one command file. Harder: `arc-council.md` grows a third mode — if it outgrows a screen,
extract per the revisit trigger.
