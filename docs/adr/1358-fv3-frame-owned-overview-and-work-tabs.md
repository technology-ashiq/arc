# ADR 1358 — FV3-B: the frame owns the room's tabs — Overview and Work, Records when a module declares records

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-B), recorded at the Cycle 17 kickoff; the Records tab is decided at kickoff by ADR-1365
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** a module needs a tab the frame cannot express from a declaration (then the frame grows a declared slot, never a per-module tab)
**Bound by:** ADR-1320 (the four-file contract) · ADR-1365 (Records)

## Context

With the verbs moved to a strip, the full docks (every op and session card, recent runs) still need a home that is not under the records.

## Options considered

1. **Frame-owned tabs: Overview = the module View, Work = the full docks (chosen).**
2. **Each module draws its own tabs** — 37 copies of the same decision, each a face-pure branch risk.

## Decision

`RoomFrame` draws `Overview · Work` when the room has ops or sessions (`frameTabs` in `frame.mjs`); the tab resets to Overview on a room change. A tab in the address (`&tab=`) is deferred.

## Consequences

- The module contract stays four files.
- `flows.mjs` opens the Work tab before it looks for a card (CI run 39540164876 → fixed in `d8f03de`).
