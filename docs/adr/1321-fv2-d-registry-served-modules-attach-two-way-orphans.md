# ADR 1321 — FV2-D: the registry is served; modules attach to it, and orphans are checked both ways

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a served room renders blank in a smoke run, or a module folder exists whose id `/api/rooms` does not serve and no gate FAILed → the two-way check has a hole; fix it before the next batch merges.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-D — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. Extends ADR-1306.

## Context

ADR-1306 made `/api/rooms` the only room list because a renamed room once emptied a screen.
v0.7 carries its own client-side `roomRegistry.js` with 36 ids. A module system can quietly
become a second registry — a folder per id is already a list.

## Options considered

1. **Served registry is truth; module folders attach by id; `face-coverage` checks both directions** — no second list.
2. **Port `roomRegistry.js` as the client's truth** — rejected in PLAN-face-v2 §10 (ADR-1306's failure mode).
3. **One-way check only (module → registry)** — a served room with no module would render blank silently.

## Decision

Option 1. A module whose id is not in `/api/rooms` FAILs `face-coverage`; a served room with no
module renders through the generic module and is REPORTED by name, never silently blank.

## Consequences

- Easier: the rail, palette, map and `org` all read one list; adding a module never edits a shell file.
- Harder: the four v0.7 extra rooms (ADR-1327) need an explicit by-name exemption for the module → registry direction.
