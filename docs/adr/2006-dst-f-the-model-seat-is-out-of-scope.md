# ADR 2006 — DST-F: the model seat is out of scope

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

"ChatGPT, Kimi, Ollama, DeepSeek" are models. They already reach arc through five drivers (ADR-0203), `engine/router.yaml` tiers (ADR-0069), the `--trial-model` seam (ADR-0220) and model-policy v2 profiles (ADR-1800..1803). Conflating the model with the harness is how a cycle builds the wrong thing. Cited from ADR-2000.

## Options considered

1. **This lane also wires model support** — that duplicates model-policy v2 and touches tiers, which are law (ADR-0069).
2. **Hands off** — the lane proves that the two doors compose, and owns neither half.

## Decision

Option 2. This cycle changes no driver, router row, profile or tier. REQ-03's non-Claude model is an ADR-1800 **profile line the owner writes**, not code this lane writes. A harness is chosen by the owner's hand, and a model by model-policy (ADR-0069 b1: no auto-switching).

## Consequences

If no non-Anthropic profile exists by Phase 03 (A-05), REQ-03 runs with the harness swap proven and the model swap recorded as **owed**, never claimed.
