# ADR 1901 — DIS-A: a miner is an imported source adapter, HN Algolia first

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source `docs/strategy/plans/PLAN-discover.md` (DIS-A). Fired by the owner ruling of 2026-10-03 (ADR-1900). growth already ships `hnAlgoliaAdapter({ offline, fetchImpl })` and `hnAlgoliaVerifier()` in `.claude/scripts/growth/lib/adapters.mjs`. They are a public, stable source, and the `fetchImpl` seam is where a fake goes.

## Options considered

1. **Discover writes its own HN client.** It gets full control, but it becomes a second walker over one API, which is the duplication A5 forbids.
2. **Import growth's adapter.** One walker, and any change to it is a growth-lane change.

## Decision

Option 2. The contract is `.claude/scripts/discover/miners/<name>.mjs`, exporting `fetch(query, {offline, fetchImpl}) → NDJSON records` and `verify()`. `miners/hn.mjs` imports growth's adapter and verifier and never copies them. Reddit public JSON is the pinned fallback, and it is written only when the kill criterion fires. The fixture fake is a `fetchImpl` that replays recorded responses. growth's `offline: true` returns `[]`, which means "quiet market" and is not a fixture.

## Consequences

growth's adapter returns `{title, objectID, query}` only. The fields REQ-01 needs are a growth change (ADR-1911).
