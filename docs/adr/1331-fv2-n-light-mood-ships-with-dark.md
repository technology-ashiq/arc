# ADR 1331 — FV2-N: the light mood ships with the dark, not after it

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a ring batch cannot reach 0 console errors in `hq-light` within its appetite → the batch is cut to generic renders for the failing rooms (Block B tripwire); light is never deferred to a later batch.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-N — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff.

## Context

v0.7 carries two moods (`html.hq` dark · `html.hq.hq-light` paper) with WCAG-AA computed per
mood. v0.7's own earlier failure mode was a light mode faked with `filter: invert()`.

## Options considered

1. **Both moods per batch: smoke runs dark + light for every ring before it merges.**
2. **Dark first, light at the end** — the AA claims stay unchecked and light breaks 36 times at once.

## Decision

Option 1. The token law is only proven by two moods.

## Consequences

- Every batch's smoke evidence carries two runs; appetite per batch already includes it.
- REQ-02's contrast ratios are computed for both moods in the `tokens.css` header in Phase 01.
