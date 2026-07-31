# ADR 0058 — PORT-I: history — link, never copy

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

The design lane has a full closed cycle of history (archives at `docs/archive/`,
evidence at `docs/evidence/`). Giving it a lane folder must not duplicate that history —
two copies of an immutable record means the record is no longer immutable. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §5 PORT-I.

## Options considered

- Copy frozen history into `initiatives/design/archive/` — rejected: duplication creates
  a second canonical copy and invites divergence.
- Index file linking to frozen locations — accepted.

## Decision

Pre-portfolio archives + evidence stay frozen at `docs/archive/` + `docs/evidence/` as
the SOLE canonical copies. A lane with prior history gets
`initiatives/<lane>/HISTORY-INDEX.md` — links + one-line summaries pointing at the frozen
locations. Lane-local `archive/` holds only cycles closed AFTER adoption. `docs/HISTORY.md`
stays the single company logbook, entries gaining `[lane]` tags.

## Consequences

- `initiatives/design/` is the one permitted "pre-scaffold" exception (~~folder +
  HISTORY-INDEX.md in Phase 1~~) because its history already exists. — **AMENDED
  2026-08-01** by [ADR-0062](0062-port-i-amendment-a-board-row-needs-a-machine-header.md):
  the pre-scaffold is folder + HISTORY-INDEX.md **+ a machine-header-only `PROGRESS.md`**.
  "Links only" collided with ADR-0051, which requires every board value to derive from the
  lane's machine header — with no header, the board's `design IDLE` would be hand-typed and
  recomputed by nobody. Nothing else in this ADR changes.
- Anyone reading a lane can reach its whole past from one file without any file moves.
