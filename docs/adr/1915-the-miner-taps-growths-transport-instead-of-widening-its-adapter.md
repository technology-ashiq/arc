# ADR 1915 — The miner taps growth's transport instead of widening its adapter

**Status:** accepted (supersedes ADR-1911)
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** growth's `hnAlgoliaAdapter` stops sending its requests through the injected `fetchImpl`. `discover-miner.bats`' replay arm then sees zero tapped responses and fails. Route that through `/arc-change --lane growth`.

## Context

ADR-1911 assumed growth's adapter keeps `{title, objectID, query}` per hit and that four more fields would be enough. Reading the whole adapter at the Phase 00 build showed something else. `hnAlgoliaAdapter` returns `attestedCandidates(out, id)`, which are **keyword phrases** attested across titles, not hits. Even a widened adapter would hand discover phrases, never per-item records. The adapter takes a `fetchImpl` and calls it once per query against `hn.algolia.com/api/v1/search`. It then classifies failures as `SOURCE_HTTP` · `SOURCE_UNREACHABLE` · `SOURCE_SHAPE` (`MineError`).

## Options considered

1. **A growth change exporting a raw-hits function.** It works, but it is a cross-lane dependency on the critical path (A-02).
2. **A second HN client inside discover.** That is two walkers over one API, which A5 and DIS-A forbid.
3. **Tap the transport.** discover passes a `fetchImpl` wrapper into growth's own adapter. The wrapper paces calls (ADR-1904), caps body size, and records each response body before handing the adapter an equivalent `Response`. The adapter still walks, and still classifies every failure. discover parses the recorded hits for `objectID · title · url · points · num_comments · created_at_i · story_text`.

## Decision

Option 3. The miner runs `hnAlgoliaAdapter({ fetchImpl: tap, hitsPerQuery })` and keeps the adapter's thrown `MineError` as the run's error. A run whose adapter succeeded but whose tap recorded nothing is `COULD NOT SCAN`, never an empty market. Fields absent on a hit stay `ABSENT`.

## Consequences

- No growth change. The handoff prompt (`initiatives/discover/handoffs/growth-hn-fields.md`) is withdrawn.
- A-02 and its fallback mode are retired, so REQ-01's fixtures run in one mode.
- The coupling is to the adapter's use of `fetchImpl`, and the revisit trigger pins it.
