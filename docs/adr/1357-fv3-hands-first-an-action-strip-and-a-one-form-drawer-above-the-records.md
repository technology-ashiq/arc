# ADR 1357 — FV3-A: hands first — an action strip and a one-form drawer above the records

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-A), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** a room's verbs outgrow one strip row at 1366 px (more than ~8 buttons), or the owner reports reaching for a verb he cannot find in the strip
**Bound by:** ADR-1339 (the work door) · ADR-1326 (the session door) · ADR-1320 (four-file module contract)

## Context

A live audit of `main` @ `17c07a5` over a copy of the canonical spine (2,679 receipts), driven in a headless Chromium at 1440×900, 1366×768 and 1024×700 found the work door real (32 ops plan, 15 sessions listed) but drawn last: `RoomFrame.tsx` rendered the module View, then `OpsDock`, then `SessionDock`, in one column. Org measured 7,732 px with its forms ~6,000 px down; ventures 8,973; money 8,634.

## Options considered

1. **A strip of one button per op and session under the room header, opening a right-side drawer holding exactly that form (chosen).**
2. **Move the docks to the top of the column** — the forms then push the records down instead; long forms (bench, absorb) fill the first screen.
3. **A floating command palette only** — fast for the owner, invisible to a reader of the room.

## Decision

Every room with verbs draws an action strip (`face/src/shell/ActionStrip.tsx`) under its header; a click opens `ActionDrawer.tsx` holding exactly that op or session card with its existing plan → run behaviour (the docks gained `only` / `bare`). Decisions live in `face/src/lib/frame.mjs`.

## Consequences

- First verb at 126 px in 27/27 rooms that have one at 1366×768 (was up to ~6,000 px).
- Each room reads its ops and sessions once more for the strip labels (debt: duplicate reads, attack 0991e16 B4).
- Closing the drawer drops what was typed — accepted for v3.
