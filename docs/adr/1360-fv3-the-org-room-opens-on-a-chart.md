# ADR 1360 — FV3-D: the org room opens on a chart — owner, CEO, departments with heads, every role by seat state

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-D), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** the role count passes ~150 or a department passes ~20 roles (the grid stops scanning), or `reports_to` grows cycles
**Bound by:** ADR-1352 (who fills each role) · ADR-1601 (role cards) · ADR-1320

## Context

`/api/org` serves `chart.departments` (10 departments, 71 roles) with `reports_to` per card and a scorecard per seat; the room drew two 71-row lists and the owner could not read the company's shape ("org la oru org chart ila").

## Options considered

1. **A tree: Owner → CEO → department boxes (head = the role others in that department report to) → role chips coloured by seat state, a card on pick (chosen).**
2. **A force-directed graph** — a dependency and a layout that moves between reads.

## Decision

`foldChart` in `org/fold.mjs` decides every chip, head, filter and card; `face/src/ui/orgchart.tsx` draws. Filters: All · Vacant · Human · Staffed. The roster and scorecards stay below as records.

## Consequences

- 71/71 chips, 10/10 departments, vacant filter 24.
- Scorecard rows exist only for scored roles; the card says so ("no scorecard row served").
