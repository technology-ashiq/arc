# ADR 0011 — Eval harness: hand-authored fixtures + node grading script + runbook (hybrid)

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** one-way
**Revisit trigger:** a probe passes on fixtures while an equivalent live dogfood fails (fixture-fidelity break), or Claude Code gains a supported way to spawn Task agents from bats — either reopens the execution-home question.

## Context
The eval harness must prove three behaviors: the verifier catches planted false facts, the council
gives the same DECISION under pro-vs-con framing, and the lint gates reject every known-bad
artifact shape. A naive probe = one full council run (research fan-out + ~8 members + verifier)
— unaffordable per-probe inside a 2-week appetite. bats (the repo's test idiom) cannot spawn Task
agents, so a bats-only harness could never exercise live behavior. The harness's artifact shape
also fixes Phase 3's deliverable, so this is a one-way door for the cycle.

## Options considered
1. **Hybrid** — hand-authored fixed Evidence Briefs + member-output fixtures under `docs/council/kickoff-v2/eval/`; a plain-Node grading script asserts outcomes; live calls spent ONLY where behavior is the thing under test (verifier probes, quick-mode framing runs); a runbook documents the protocol — pros: per-probe cost is one verifier or quick call, deterministic checks stay free; cons: fixtures can drift from the live contract.
2. **bats-only deterministic** — pros: cheapest, CI-idiomatic; cons: covers only council-lint determinism — planted-error catch and flip-rate (the harness's core value) are untestable.
3. **Full live runbook** — every probe a real council run — pros: highest fidelity; cons: cost forces a probe set too small to mean anything within the appetite.

## Decision
Option 1, the hybrid. Fixtures + grading script carry the deterministic layer; the live budget is
spent surgically: verifier-only calls for planted-error probes, quick-mode calls for framing
flip-rate. The carrying reason: it is the only option that tests the live behaviors that matter at
a per-probe cost the appetite survives.

## Consequences
Easier: probes are re-runnable and cheap; grading is deterministic and scriptable; eval assets are
council-scoped and repo-only (sync-to-project already excludes `docs/council/`). Harder:
fixture-drift is now a named risk — Phase 3 regenerates fixtures from Phase 2's dogfood run and
schema-validates them against council-lint before grading (pre-mortem row 5 carries this).
