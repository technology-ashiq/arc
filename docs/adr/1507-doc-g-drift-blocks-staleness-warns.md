# ADR 1507 — DOC-G: drift BLOCKS, staleness WARNs

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** after the cycle, a narrative is found stating a fact that `wiki-stale` had warned on for 30+ days and nobody fixed → reconsider promoting stale to BLOCK for that entity type only.

## Context

Locked (DOC-G). Narrative can name things that no longer exist (drift), or describe facts that have
since moved (staleness). Blocking on prose makes people write none.

## Decision

- `wiki-drift.mjs` — **BLOCK.** Scans narrative files for references to repo paths, `ADR-NNNN`,
  script / driver / command / agent names, and FAILs naming each one that does not exist in
  `wiki.json` or on disk. Mutant: a narrative citing `ADR-9999` and `drivers/ghost.mjs` FAILs
  naming both (REQ-05).
- `wiki-stale.mjs` — **WARN, exit 0.** Each narrative carries a front-matter fingerprint of the
  generated facts it was written against; divergence prints a WARN naming the entity and the
  changed fact keys.
- `--audit-counts` (REQ-07) re-derives every number printed on any page from `wiki.json` and FAILs
  on a mismatch.

## Consequences

The reference-extraction grammar is the risky part (a path-looking string in prose that is not a
reference). It is built against fixtures at both extremes and attacked on both surfaces (ADR-1511).
