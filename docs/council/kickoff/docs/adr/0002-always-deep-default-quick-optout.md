# ADR 0002 — Always-deep default, with a `quick` opt-out

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** deep runs are so slow/costly that users routinely reach for `quick`, inverting the intended default.

## Context
A council run can range from a 3-member snap take to a full research-plus-roster deliberation. The user
explicitly wants maximum thoroughness ("agents unlimited, use as many as needed") and named breadth
across many domains. We must pick the DEFAULT behaviour of a bare `/arc-council "<q>"`.

## Options considered
1. **Quick by default, deep on request** — pros: cheap default; cons: contradicts the stated goal of a world-best, thorough council; the good path is opt-in and under-used.
2. **Always-deep by default, `quick` opt-out** — pros: matches the goal (full research fan-out + full relevant roster + verifier every run); cons: higher token/latency cost per run.

## Decision
Always-deep is the default; `/arc-council quick "<q>"` is the fast opt-out (core stances only, no research
fan-out, no verifier). Chosen because the whole point of the tool is rigor, and cost is bounded by the
expert ceiling (ADR-0004) and researcher cap.

## Consequences
Easier: every default run is thorough and defensible. Harder: cost — mitigated by `quick`, the domain
ceiling, and a single research round.
