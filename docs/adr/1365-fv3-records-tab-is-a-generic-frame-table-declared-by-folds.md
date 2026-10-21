# ADR 1365 — FV3-I: the Records tab is one generic frame table that each fold declares

**Status:** accepted 2026-10-21 by the owner at the Cycle 17 kickoff (fork 1, "Generic frame table")
**Lane:** face (Cycle 17) · **REQ:** REQ-02 · **Phase:** 01
**Reversibility:** one-way
**Revisit trigger:** a room's records need a shape the declaration cannot express (nested rows, a chart) — then the declaration grows a typed slot, never a per-module tab
**Bound by:** ADR-1358 · ADR-1320 (four files, no fifth) · ADR-1324 (no facts bundle)

## Context

Long rooms still scroll: ventures 10,309 px, money 9,637, story 8,339, org 8,263 at 1366×768 after #449. Records are drawn inline by each View.

## Options considered

1. **Each `fold.mjs` declares its record collections (key, columns, search fields, cap 8); the frame draws one shared `RecordsTable` on a third tab (chosen).** One change fixes every room; no new door route.
2. **Each long module splits its own View** — per-room work, a face-pure branch risk in every View.
3. **A fifth module file** — breaks the four-file contract.

## Decision

`frameTabs` gains `records` when the fold declares any collection; caps and search run client-side over rows the door already serves; a declared collection moves off Overview.

## Consequences

- No pagination and no new route; a collection larger than the door serves is still bounded by the door.
- Modules migrate one at a time; ventures, money, story and org first.
