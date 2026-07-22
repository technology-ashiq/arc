# ADR 0027 — SPINE-D: Brief + inbox are CLI-first under `.claude/scripts/hq/`

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** two-way
**Revisit trigger:** brief overflows one screen with real load, or ≥3 earning ventures →
the dashboard BRIEF's pull trigger fires (`docs/strategy/plans/BRIEF-dashboard.md`); the
dashboard becomes another consumer of the SAME reader API, no CLI change.

## Context

The day must be readable now, with zero new infrastructure. A dashboard UI is an explicit
no-go this cycle; new slash commands are also excluded (the 22-command surface is frozen —
CLIs only per the design source and kickoff instructions).

## Options considered

1. **`arc brief` / `arc inbox` as CLIs in `.claude/scripts/hq/`** — chosen.
2. **HTML dashboard now** — rejected: no-go; UI polish is a rabbit hole before the data
   contract is proven on real days.
3. **New slash commands** — rejected: kickoff instruction locks the command surface this
   cycle; CLIs compose with hooks and bats more cheaply.

## Decision

Brief and inbox are CLI-first, living under `.claude/scripts/hq/` and shipped by
`products/hq/manifest.json`. `arc brief` renders one screen (≤40 lines, needs-you / money /
progress / background, overflow collapses to counts, `--full` expands). `arc inbox` /
`arc approve` / `arc reject` handle approvals. The HTML dashboard is a later cycle's consumer
of the same reader API.

## Consequences

- Everything is bats-testable and golden-fixturable from day one (REQ-05, REQ-06).
- No new slash commands to document, sync, or registry-map this cycle.
- When the dashboard cycle fires, it consumes the reader contract (ADR-0030) — the CLI
  remains as the scriptable surface.
