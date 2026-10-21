# ADR 1368 — FV3-L: the logic attacker runs on a DeepSeek trial model via OpenRouter, credentials in the owner's env

**Status:** accepted 2026-10-21 by the owner at the Cycle 17 kickoff (fork 4, "DeepSeek via OpenRouter"; exact model id confirmed by the owner in Phase 01)
**Amended:** 2026-10-21, before the kickoff stamp, by the owner ("face la update panniruken antha model use panu"): the trial model is **`z-ai/glm-5.3-flash` via OpenRouter**, the model he saved in the face's Keys tab, not a DeepSeek id. The decision's shape is unchanged — one OpenRouter trial model, not Anthropic's family, `model_source: trial`, credentials outside the repo; the title and file name keep the fork's wording so links stay stable. The credentials live in the face's keys store (ADR-1351), not the shell: the driver resolves only the key from it, so the session exports `ARC_LLM_ENDPOINT` and `ARC_ATTACK_TRIAL_MODEL` from the store's values into the `/arc-attack` child.
**Lane:** face (Cycle 17) · **REQ:** REQ-05 · **Phase:** 01
**Reversibility:** two-way
**Revisit trigger:** Cycle 17's close (Phase 05 retro): the attacker will by then have run on every phase's PRs, so Phase 05 decides keep-as-trial or file the ADR-0069 amendment (`independent-family-verifier` row plus class row) as the next cycle's first slice; no production reliance on the trial model before that decision
**Bound by:** ADR-0226 (two surfaces) · ADR-0069(g) (trials) · ADR-0220 (the trial seam)

## Context

Every face PR since Cycle 16 Phase 06 ran the boundary surface only; `ARC_ATTACK_TRIAL_MODEL`, `ARC_LLM_ENDPOINT` and `ARC_LLM_API_KEY` are set nowhere.

## Options considered

1. **DeepSeek through OpenRouter (proven in arc: distribute REQ-03 ran on `deepseek-v4-flash-0731`) (chosen).**
2. NVIDIA NIM free model — untested reliability. 3. Cerebras — untested in arc.

## Decision

The three variables live in the owner's shell env only (names already in `.env.example`); never committed. Phase 01 closes REQ-05 on one real attack receipt with `model_source: trial`.

## Consequences

- The ADR-0069 amendment is decided at Phase 05's retro (this ADR's trigger), not built this cycle.
- Before each real run a 60 s smoke on a tiny `attack-diff` input; a failed round-1 LOGIC re-runs as round 1 on a second-family fallback (retro arc-org 2026-10-02/-03/-05, arc-engine-cycle8 2026-10-08).
