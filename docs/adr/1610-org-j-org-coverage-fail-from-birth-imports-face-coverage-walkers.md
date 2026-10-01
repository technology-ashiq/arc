# ADR 1610 — ORG-J: `org-coverage.mjs` is FAIL-FROM-BIRTH with `--mutant-selftest` and imports its walkers from `face-coverage.mjs`

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** Face changes a walker's export shape during this cycle (A-07) -> coordinate through a paste-ready prompt to the face session; never fork a local walker.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-J). A second walker is the recurring "validate one read, compare another" defect (DOC-A precedent, ADR-1501). Retro 2026-08-24: a gate whose expected set is its own list measures its own memory. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Import walkers, FAIL-FROM-BIRTH, mutant self-test**.
2. **WARN-first** — the repo default for new gates; rejected for the same stated reason as `face-coverage`, `policy-lint`, `jobs-lint`: a coverage lint that only warns is a hope.

## Decision
Checks: every agent ∈ ≥1 role · every role reference resolves · every venture in `ventures.yaml` has a team manifest and vice versa · no E2 role seated by an agent · every staffed role has a KPI over `KINDS` · every hired seat names a driver, a tier and a fixture verdict (REQ-11) · every consumed kind has a producer (REQ-13) · a head seat has ≥2 staffed workers (ORG-O). The expected sets are derived from the source on disk, never from the cards. Ships `--mutant-selftest`.

## Consequences
Easier: the org chart cannot drift silently. Harder: every agent added anywhere in arc now needs a role in the same change.
