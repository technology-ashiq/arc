# ADR 1368 — FV3-L: the logic attacker runs on a DeepSeek trial model via OpenRouter, credentials in the owner's env

**Status:** accepted 2026-10-21 by the owner at the Cycle 17 kickoff (fork 4, "DeepSeek via OpenRouter"; exact model id confirmed by the owner in Phase 01)
**Lane:** face (Cycle 17) · **REQ:** REQ-05 · **Phase:** 01
**Reversibility:** two-way
**Revisit trigger:** the attacker has run on more than one phase's PRs (router.yaml: production use → an ADR-0069 amendment filling `independent-family-verifier` and its class row)
**Bound by:** ADR-0226 (two surfaces) · ADR-0069(g) (trials) · ADR-0220 (the trial seam)

## Context

Every face PR since Cycle 16 Phase 06 ran the boundary surface only; `ARC_ATTACK_TRIAL_MODEL`, `ARC_LLM_ENDPOINT` and `ARC_LLM_API_KEY` are set nowhere.

## Options considered

1. **DeepSeek through OpenRouter (proven in arc: distribute REQ-03 ran on `deepseek-v4-flash-0731`) (chosen).**
2. NVIDIA NIM free model — untested reliability. 3. Cerebras — untested in arc.

## Decision

The three variables live in the owner's shell env only (names already in `.env.example`); never committed. Phase 01 closes REQ-05 on one real attack receipt with `model_source: trial`.

## Consequences

- The ADR-0069 amendment is deferred past Cycle 17 and named as this ADR's trigger.
