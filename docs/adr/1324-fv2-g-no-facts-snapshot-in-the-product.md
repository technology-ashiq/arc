# ADR 1324 — FV2-G: no facts snapshot in the product

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a module needs a repo fact that no allow-listed read route can serve even after Phase 04 → the gap stays a labelled `NOT SERVED` residue and a route is proposed; a bundled file is never the answer.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-G — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff.

## Context

v0.7 ships `src/data/arcFacts.js`, a 137 KB generated snapshot of repo facts. Its ancestor
`arcKnowledge.js` was already caught quoting 22 commands / 23 agents where the frozen contract
counts 26 / 30.

## Options considered

1. **No bundle: the door serves facts through allow-listed routes, or the module renders `NOT SERVED`.**
2. **Ship the snapshot as a seed for rooms with no route** — rejected in PLAN-face-v2 §10: a stale fact wearing a live fact's clothes.

## Decision

Option 1, enforced by a grep-lint that refuses a bundled facts module anywhere under
`face/src/**`. Each P03 batch exits with its `NOT SERVED` list; P04 builds routes against those
lists, not against the plan's table.

## Consequences

- Easier: every number on a screen traces to a door route.
- Harder: early batches will show `NOT SERVED` panels; that is the evidence, not a defect.
