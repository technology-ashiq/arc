# ADR 1361 — FV3-E: a dead button is a lie — a not-ready session is disabled with its missing process named

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-E), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** a session's readiness depends on something other than its process file (a driver, a key) and the reason line says the wrong thing
**Bound by:** ADR-1326 · ADR-1339 (session residue filed to lanes)

## Context

6 of 15 session rows have no process behind them (`phase-close`, `qa-run`, `ship-run`, `hire-certify`, `absorb-adopt`, `growth-draft`); their Start buttons drew like live ones.

## Options considered

1. **Render disabled with "needs process `<name>` — not built yet", never hidden (chosen).**
2. **Hide them** — the owner loses the map of what is missing.

## Decision

`notReadyReason` in `frame.mjs`; strip badge "not built yet" plus the card's inline reason; Start disabled.

## Consequences

- 6/6 not-ready sessions honest. `qa-run` and `ship-run` are built in Phase 02 (ADR-1366).
