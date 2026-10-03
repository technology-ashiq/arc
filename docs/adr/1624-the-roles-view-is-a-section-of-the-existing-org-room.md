# ADR 1624 — The roles view is a section of the existing `company/org` room, not a new room

**Status:** accepted
**Date:** 2026-10-03
**Product:** `org`
**Reversibility:** two-way

## Context
The owner ruled on 2026-10-02 that the org chart gets a face room through org Cycle 19, not a face phase. The face
already serves a `company/org` room (face v2 Phase 03): a roster of the lanes and the ADR band map. A new room needs
birth rows in `expected-set.json`, `room-copy.json`, `modules-v2.json`, the registry and the Map, and a new
station the owner must learn. The role catalog answers the same question the lane roster answers ("who works
here"), one level down.

## Options considered
1. **A new room `company/roles`**: a clean page of its own / five contract files touched, a 38th station, a
   second place named "org".
2. **A section added to `company/org`**: zero new contract rows, the owner finds roles where he already looks for
   the company / the room grows longer.

## Decision
Option 2. The lane roster and band map stay exactly as they are; the roles, teams and scorecards are added below
them, read from one new route (ADR-1625). The room's copy sentence changes to name roles as well as lanes.

## Consequences
No registry birth, so face-coverage's room count does not move. The room's fold gains one route, so its manifest
`routes` and the door's route table change. If the section outgrows the room (a review that wants its own page),
splitting it into its own room later is a contract addition, not a rewrite.
