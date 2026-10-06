# ADR 1911 — The HN adapter's missing fields are a growth-lane change, additive only

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** growth declines the widening, or it has not merged by Phase 00 day 2. Then the miner records only `title · objectID`, engagement and ts are `ABSENT`, and `pain_frequency` is computed from match counts alone.

## Context

REQ-01 needs `source_url · text · engagement · ts · source_id` per record. Kickoff verification of `growth/lib/adapters.mjs:63` found that the adapter keeps only `{title, objectID, query}` from each Algolia hit and drops `points`, `num_comments`, `created_at_i` and `story_text`. Under DIS-A (ADR-1901) and pre-mortem #5, discover may not edit growth's file.

## Options considered

1. **Discover re-fetches item detail itself.** That is a second walker over one API, which is forbidden.
2. **An additive growth change.** The adapter keeps the four fields when present, existing consumers ignore them, and growth owns the change.

## Decision

Option 2. It is a cross-lane ask, so it goes to growth's session as a paste-ready `/arc-change --lane growth` prompt in Phase 00 step 1 and lands in growth's own PR. Discover consumes it only after it has merged.

## Consequences

Phase 00 depends on another lane's merge. The revisit trigger is the fallback, so the dependency cannot strand the phase.
