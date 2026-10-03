# ADR 1625 — `GET /api/org` serves org's own extract: the chart model, the teams and the scorecards, imported, never re-derived

**Status:** accepted
**Date:** 2026-10-03
**Product:** `org`
**Reversibility:** two-way

## Context
The room needs the 71 cards by department, the venture teams and each staffed seat's scorecard. All three
already have exactly one producer: `org-catalog.mjs chartModel()` over `org-coverage collect()`, the team
manifests under `org/teams/`, and `org-review.mjs` (`loadOrg`, `readSpine`, `placeAll`, `scorecard`,
`verdictFor`). The face's fold must stay decision-free and node-importable with no install (ADR-1320). The
`/api/reference` route (ADR-1346) is the precedent: one read route in its own directory under
`.claude/scripts/hq/lib/face/`, importing the producer and refusing whole on a wrong shape.

## Options considered
1. **Serve `org/chart.json` through the `/api/file` allow-list and count scorecards in `fold.mjs`** / a second
   attribution counter in the face: the twin-fix shape this repo has recorded three times.
2. **One route `GET /api/org`** whose handler imports the org producers and returns `{ schema, chart, teams,
   scorecards }`: one count, the door's scrub and envelope.

## Decision
Option 2. The handler lives in `.claude/scripts/hq/lib/face/org/route.mjs`. It is GET-only, takes no query
(`BAD_ARGS` otherwise), writes nothing, and reads the spine the door already reads (`ctx.root`, so sim mode
scores the sim spine). A seat with no placed receipt is served as `evidence: false`, never as a zero. A
missing or invalid `org/teams/` serves `teams: []` with the reason; an attribution map with findings refuses
the scorecards part by name and still serves the chart.

## Consequences
The door gains one route and the face's `door.mjs` route table gains one entry. The route's body is held equal
to `org-catalog --chart`'s model and `org-review`'s scorecards by a fixture, so the room and the CLI cannot
disagree. A heavy spine makes the route as slow as `org-review --all`; concurrent requests share one computation,
as `/api/reference` does.
