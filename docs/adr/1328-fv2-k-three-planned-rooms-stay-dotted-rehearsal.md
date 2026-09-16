# ADR 1328 — FV2-K: the three planned rooms stay dotted, and every write inside them says REHEARSAL

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** `/arc-kickoff --lane ops|trader|discover` births the lane → its manifest `face:` section takes over from `planned-rooms.json` and the module drops its REHEARSAL marking in the same change.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-K — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. Keeps ADR-1306 (planned rooms) and ADR-1313 (honesty classes).

## Context

v0.7 draws `ops` · `trader` · `discover` as working rooms with write flows. None of those lanes
exists in arc. The Phase 09 close carried a defect where planned `trader` wore LIVE.

## Options considered

1. **Render from the planned-rooms registry, dotted; every write path says `REHEARSAL`; no manifest invented.**
2. **Invent manifests so they render like live rooms** — mixes planned with real.

## Decision

Option 1.

## Consequences

- Their v0.7 flows run as REHEARSAL assertions only and never touch the work door.
- The carried `trader wears LIVE` defect is closed by this batch, not re-carried.
