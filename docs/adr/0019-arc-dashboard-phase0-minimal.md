# ADR 0019 — /arc dashboard ships minimal in Phase 0, upgrades to registry in Phase 2

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** two-way
**Revisit trigger:** Phase 0 appetite pressure — if Phase 0 runs hot, the minimal /arc is the
designated cut (council-only install is Phase 0's non-negotiable demo; /arc is not).

## Context

The design doc's Phase 2 exit criterion ("/arc INSTALLED column reads the registry, no
file-presence guessing") presumes a dashboard already exists, but no phase explicitly built
it. Two orderings were possible.

## Options considered

1. **Phase 0 minimal → Phase 2 upgrade**: `.claude/commands/arc.md` + `arc-status.sh` ship in
   Phase 0 using file-presence detection; Phase 2 swaps ONLY the data source to
   `arc-registry.json` — pros: Phase 0 gets a user-visible demo artifact; the command surface
   never changes, so nothing is throwaway; cons: Phase 0 scope grows slightly.
2. **Phase 2 only, registry-native**: pros: leaner Phase 0; cons: Phase 0's only demo is the
   council install; the umbrella has no face until mid-initiative.

## Decision

Option 1. The orchestrator's visible surface exists from the first phase; Phase 2 is a data
source swap behind an unchanged command. `/arc` stays read-only in both incarnations —
"the script is the gate" (arc-resume pattern).

## Consequences

Easier: every phase-done demo from Phase 0 onward can open with `/arc`. Harder: Phase 0
carries one more artifact — mitigated by the revisit trigger naming it the designated cut.
