# ADR 0002 — Noise defense is a prerequisite, not polish

**Status:** accepted · 2026-07-09

## Context
Pre-mortem #1: the most likely death of this initiative is finding-spam — first scan dumps hundreds of findings, gates get flipped to warn, moat dies. Every failed SAST rollout in industry follows this pattern.

## Decision
Phase 2 (baseline + LLM triage + suppression-with-justification) ships BEFORE any tool expansion (Phases 3–4). Blocking is **new-code-only**; pre-existing findings freeze into a committed baseline. Triage may only downgrade tool findings, never invent blocking ones. Suppression without a committed justification entry = block.

## Consequences
+ Gates stay credible from day one of tool expansion.
+ Suppressions become evidence (auditable trail).
− Real pre-existing vulns can hide in the baseline — mitigated by a scheduled baseline-review item in `/arc-retro`.
