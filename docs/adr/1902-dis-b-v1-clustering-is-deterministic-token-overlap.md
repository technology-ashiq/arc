# ADR 1902 — DIS-B: v1 clustering is deterministic token-overlap, zero-dep

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** on a real hunt, precision is demonstrably insufficient and a retro records it. Then embeddings come in through an `arc-run` driver (router.yaml, ADR-1800 profiles).

## Context

Locked in the design source (DIS-B). Fired by the owner ruling (ADR-1900). Embeddings bring a model dependency and non-determinism into a pipeline whose non-negotiable is that the same snapshot gives byte-identical clusters.

## Options considered

1. **Embeddings now.** Recall is better, but it needs a model and the bytes vary.
2. **Token-overlap (Jaccard over a normalised token set) with a fixed threshold and a stable tie-break.** It is reproducible and reviewable.

## Decision

Option 2. The stopword list is growth's exported `STOP` (`adapters.mjs`), so there is one reviewable list with two readers, the same posture as ADR-1116. Clusters are ordered by (size desc, earliest `ts`, smallest `source_id`).

## Consequences

The kill criterion stands: if clustering is garbage after 2 days, discover ships a frequency sort without clusters.
