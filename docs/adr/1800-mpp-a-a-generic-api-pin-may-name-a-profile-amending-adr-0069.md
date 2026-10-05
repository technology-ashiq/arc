# ADR 1800 — MPP-A: a `generic-api` pin may name a profile (amending ADR-0069 blocks a and b)

**Status:** accepted
**Date:** 2026-10-05
**Product:** `model-policy` (lane born again as model-policy v2; claims the century 1800–1899)
**Reversibility:** one-way
**Revisit trigger:** a profile's content changes and a run's quality or cost moves without anyone being able to say which
model ran. That would mean the receipt is not carrying what this ADR promises, and the profile has become the run-time
tier change block (b)(1) forbids.

## Context

ADR-0069 makes tiers law. `engine/router.yaml` implements the law as `task class → tier → driver → model`, and the model is
`models[tier][driver]`. That works for `claude-code` and `codex`, where a vendor CLI owns the endpoint and the model is
the only thing that varies. It does not work for `generic-api`. One driver there speaks to any OpenAI-compatible gateway:
OpenRouter, OmniRoute, AgentRouter, a local Ollama. What varies is three things together: the gateway URL, its key and the
model id. Today the router can pin only the third. The first two come from the environment (`ARC_LLM_ENDPOINT`,
`ARC_LLM_API_KEY`), so the gateway a routed run reaches is decided by whatever shell started it. This is the
"environment as the real knob" problem block (b)(1) was written against, one field over.

The owner's ask (2026-10-05): "normal drivers ku model fix ah irukum, generic api la configurations maarum, so nama neraya
profiles add pannalam, eponalum profile change pannalam".

## Options considered
1. **Pin a raw model id for `generic-api` as today.** Endpoint and key stay in the environment. Not reviewed, not receipted.
2. **Profile in the router: `generic-api: profile:<name>`.** The router names WHICH profile, as a reviewed diff. The
   profile's content (URL, key, model id) is owner-edited and recorded on every receipt.
3. **An owner override layer above the router.** A per-class owner choice beats a routed tier at run time. It needs block
   (b)(1) relaxed for every class, and the router stops being the routing truth.
4. **Drop tiers, route `class → driver → model|profile` directly.** This loses one-line upgrades, the fallback model
   (a fallback hop has no model without a tier), the agent seat map and the per-tier metrics.

## Decision

**Option 2.** The chain stays `task class → tier → driver → model | profile`.

- **Block (a), amended.** For `generic-api` only, a value in `models[tier]["generic-api"]` may be `profile:<name>`
  instead of a model id. `claude-code` and `codex` keep model ids. A `profile:` value under any other driver is a router
  load fault. Tier names, the seat map and the four tiers are unchanged.
- **Block (b)(1), clarified, not relaxed.** No component changes a tier, a driver or a profile assignment at run time.
  Which profile a tier or class points to is a reviewed `router.yaml` diff, like any pin. The CONTENT of a profile (URL,
  key, model id) is owner-controlled and edited outside the repo (ADR-1801). This is an explicit owner act, never an
  automatic switch, and every run makes it visible (below).
- **Block (e) (MP-F fingerprint), extended.** A profile-resolved run is receipted `model_source: profile`, with `model`
  set to the actual model id the gateway was asked for, plus `profile: <name>` and `gateway_host: <host>`. It is never
  receipted `router`, because the reviewed diff pinned the profile name, not the model id inside it. The key is never on
  a receipt, an argument list or a log line.
- **Unchanged.** No auto-switching anywhere. A failing profile does not fall to another profile or to the environment.
  `--trial-model` and `--owner-model` stay refused on a routed tier (ADR-0220, ADR-1350).

## Consequences

- The owner can add as many gateways as they like and swap a profile's model or gateway with no PR. Moving a tier or class
  to a different profile still goes through review.
- A receipt now answers "which model actually ran" for `generic-api`. Until this ADR it could not: the router said
  `unpinned` and the environment decided.
- Two runs of one class a week apart can reach different models with no router diff between them. That is the accepted
  cost. The `model`, `profile` and `gateway_host` fields are what make it auditable rather than silent.
- `codex`'s missing model entry and the empty `independent-family-verifier` row are untouched. Filling them is a separate
  policy decision this ADR does not make.
