# ADR 1363 — FV3-G: the shell gets out of the way — the answer closes on a room change, rings fold, the scrollbar gutter holds

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-G), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** the rail's rings need state shared across devices (then it is a capability, not per-viewer storage)
**Bound by:** ADR-1331 (moods) · ADR-1349 (surfaces)

## Context

The Ask answer survived a room change and covered the next room; the rail clipped at 768 px; and — found by CI on #449 — the page's scrollbar appeared as a room's records loaded, so every right-aligned header control jumped ~15 px under a pointer already on its way.

## Options considered

1. **Close the answer on a place change; fold rings with per-viewer storage written only on a click (null-prototype maps); `scrollbar-gutter: stable` on `html.hq` (chosen).**
2. **Overlay scrollbars** — hides the jump on some engines only.

## Decision

`Dock` takes `place`; `lib/rail.mjs` decides folds; `index.css` holds the gutter.

## Consequences

- Attack fixes 0991e16 B1/B2 and 7b0c082 B1 pinned in `fixed-defects.md`.
