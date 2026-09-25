# ADR 1511 — DOC-K: a two-surface adversarial pass on the extractor and on each gate

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way

## Context

Locked (DOC-K), and repo law (`CLAUDE.md` build process): a gate is not done until two fresh
agents with different surfaces have attacked it and their holes are fixed and pinned as fixtures.
The author's own 26 breaking inputs found 0 holes where an unanchored agent found 9.

## Decision

Each of the extractor (P00), `wiki-coverage` (P01), the renderer + dirty-diff check (P02), and
`wiki-drift` / `wiki-stale` (P03) gets `/arc-attack` (ADR-0226): one attacker on parsing and
decision logic, one on the filesystem / shell / OS boundary, each carrying
`initiatives/docs/fixed-defects.md` with the instruction to check every line in every OTHER file.
The pass attacks the **test** that protects each rule as well as the rule. At most two rounds per PR
(memory: attack rounds capped at two); leftover LOWs go to the lane debt ledger.

## Consequences

Each phase's appetite includes its pass. Found holes are appended to `fixed-defects.md` one line
each.
