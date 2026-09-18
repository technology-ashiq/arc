# Phase 04 — the real-place check (2026-09-18)

The door in **live** mode from the main clone at `0a4cb262` (the merge of #248), over the canonical spine, every
Phase 04 route read once. Read-only GETs; only the status and each body's list sizes are recorded, never a body.
Driver: a scratch script that boots `arc-dash.mjs --port 8433` with a session token and fetches each route.

```
door: mode=live events=1359 torn=0 unreadableDays=0
200 /api/engine route=/api/engine sources=2 drivers=5 classes=6 faults=0
200 /api/model-policy route=/api/model-policy sources=1 tiers=4 classes=6 faults=0
200 /api/policy route=/api/policy sources=1 capabilities=8 levels=4 subjects=7 ungrantable=5
200 /api/jobs route=/api/jobs sources=1 jobs=2
200 /api/evolve route=/api/evolve sources=0 experiments=0 contracts=0
200 /api/memory route=/api/memory sources=1 lessons=94
200 /api/bench route=/api/bench sources=0 runs=0
200 /api/roster route=/api/roster sources=1 hires=1 runs=20
200 /api/council route=/api/council sources=0 verdicts=0
200 /api/slices route=/api/slices sources=2 lanes=6
200 /api/gates route=/api/gates sources=1 gates=7
200 /api/learn route=/api/learn sources=1 rules=94 thisWeek=3
200 /api/adrs route=/api/adrs sources=1 adrs=287
200 /api/growth route=/api/growth sources=0 published=4 clusters=1
200 /api/leads route=/api/leads sources=1 leads=0 suppressed=0
200 /api/legal route=/api/legal sources=2 seals=5 publishGate=0
200 /api/ventures route=/api/ventures sources=1 criteria=2 ventures=1
200 /api/absorb route=/api/absorb sources=2 techniques=1 adoptedPerLane=1 warnings=0
200 /api/pnl?by=day route=/api/pnl sources=0 series=14
LIVE: 19 of 19 routes answered 200
```

What the zeros mean, so none is read as a failure: the live spine carries no `experiment.*`, `council.verdict`,
`run.completed` from arc-bench, or `outreach.sent` receipt yet, so evolve, council, bench and leads answer with empty
lists over a spine that was READ (each route names itself; an unreadable one would have been a named refusal). The
list sizes that are not zero agree with the tree: 287 ADR files, 94 retro-log lessons, 7 gates, 6 LIVE lanes.
