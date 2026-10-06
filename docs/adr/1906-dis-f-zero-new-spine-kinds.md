# ADR 1906 — DIS-F: zero new spine kinds; the spine reader only

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source (DIS-F). Fired by the owner ruling (ADR-1900). Kickoff verification: the closed kind list in `validate.mjs` has **46** kinds, not the 30 the design source counted. Every kind discover needs (`idea.captured · council.verdict · approval.requested · decision.recorded · run.completed · cost.incurred`) is a member.

## Options considered

1. **A `discover.*` family of kinds.** Bespoke, but a company-organ change for every lane.
2. **Existing kinds, with the process named in the payload.**

## Decision

Option 2. Discover emits only the six kinds above, with `run.completed process=discover@x.y.z`. It reads through the spine reader (SPINE-G, ADR-0030), never through a side file. The `hq.policy.yaml` row `process:discover` lands with the first emission (POL-I). Discover never edits the payload of a council kind (ADR-1910).

## Consequences

Validation is the spine's. A malformed emission quarantines, and a test asserts that it did not.
