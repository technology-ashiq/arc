# ADR 1336 — Phase 00 is the harness steel thread: v0.7 in, L3 built on CI, the ported smoke opening today's rooms

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** Phase 00 reaches its 2-day appetite (100%, no unallocated day) without a green browser suite on CI → stop; the owner rules between ubuntu-only browser runs (ADR-1335 option 2) and cutting REQ-09 to build-only, before Phase 01 starts.
**Provenance:** decided at the Cycle 16 kickoff (two-way door), under the kickoff rule that Phase 0 is the thinnest end-to-end slice and phases are ordered by risk.

## Context

PLAN-face-v2 §6 made P00 documentation only (intake + contract, 1d) and put the smoke port
inside P03 (8d). The single largest unknown in the cycle is not a room: it is whether `face/`
builds and a headless browser opens it on an 18-job, 5-configuration CI that has never installed L3 (ADR-1335).
If that fails in P03, it fails after 5 days of tokens, kit and shell work that all assumed it.

## Options considered

1. **P00 = intake + contract + the harness thread: `npm ci` + build on every leg, door in sim mode over the fixture spine, the ported smoke opening the 34 rooms served today with 0 console errors; 1 day moves from P03 (8→7) to P00 (1→2).**
2. **Keep the smoke port in P03** — the riskiest unknown lands after 5 days of dependent work.

## Decision

Option 1. The appetite total stays 24 days; Block A becomes 6 days and Block B 10. The kill
tripwires keep PLAN-face-v2 §9's rule — measured at 50% of each block — at their new day counts.

## Consequences

- Batch 1 (command ring) starts with a proven harness instead of building one.
- Phase 00 smoke runs one mood (today's surface has no light mood); both moods become mandatory from Phase 01 (ADR-1331).
