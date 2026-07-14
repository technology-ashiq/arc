# ADR 0003 — Shared Evidence Brief as the canonical fact source (members may gap-fill)

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** members' independent gap-fill searches routinely contradict the shared brief, so a single canonical source stops being coherent.

## Context
Members need facts to argue over. Either each stance-member researches independently (N divergent source
sets), or a dedicated researcher pass builds ONE shared brief the whole council uses. This choice is baked
into which subagents get web tools and into the verifier's grading target.

## Options considered
1. **Each member researches alone** — pros: maximum coverage; cons: N independent, unreconciled fact sets; the verifier has nothing canonical to grade against; more hallucination surface.
2. **Single shared Evidence Brief** — pros: one canonical, triangulated source; the verifier grades every point against it; cheaper; cons: a gap in the brief is a gap for everyone.
3. **Shared brief + per-member gap-fill** — pros: canonical ground AND thoroughness; cons: members must fold new facts back with sources.

## Decision
Option 3. A `council-researcher` fan-out builds a shared, deduped, triangulated **Evidence Brief**; every
member argues from it and MAY run targeted gap-fill searches, folding any new fact back into their answer
with its source so the verifier can still grade it. Chosen because it keeps one canonical source (coherent
grading) without capping thoroughness.

## Consequences
Easier: consistent verification, less hallucination divergence. Harder: members carry both a shared brief
and a gap-fill discipline — enforced by the no-fabrication non-negotiable.
