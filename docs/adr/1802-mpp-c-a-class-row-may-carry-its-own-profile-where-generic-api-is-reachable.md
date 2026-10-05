# ADR 1802 — MPP-C: a class row may carry its own `profile:`, only where `generic-api` is reachable; faults at load

**Status:** accepted
**Date:** 2026-10-05
**Product:** `model-policy` (implemented in `engine/router-row.mjs` and `arc-run.mjs`)
**Reversibility:** two-way
**Revisit trigger:** —

## Context

A tier pin is shared by every class in the tier. The owner's example (2026-10-05) puts two classes in one tier on two
gateways: `review-diff → high-judgment → generic-api → omni-ds` and `attack-diff → high-judgment → generic-api →
openrouter-glm`. A tier-level pin alone cannot express that.

## Options considered
1. **Tier-level profile only.** Simple, but the owner's example is impossible.
2. **An optional `profile:` key on a class row.** It overrides the tier's `generic-api` pin for that class. The tier still
   decides the model for every other driver in the chain, so a fallback hop keeps a model.
3. **A new tier per gateway.** Rejected: tier names must exist in ADR-0069 block (a) (process-lint `router-tier`), and a
   tier named after a vendor breaks provider neutrality (Constitution A7).

## Decision

**Option 2.** Resolution for one attempt on driver `d`:

1. `d` is not `generic-api` → `models[tier][d]` as today. A class `profile:` is ignored for this hop.
2. `d` is `generic-api` and the class row has `profile:` → that profile.
3. Otherwise `models[tier]["generic-api"]`: a `profile:<name>` resolves the profile, and a plain id stays a plain pin
   (`model_source: router`).

This is recomputed per fallback hop, as the pin already is. So `driver: claude-code, fallback: [generic-api], profile: X`
runs the tier's Claude model first and profile X only on the hop.

**Load-time faults** (`router-row.mjs`, so `arc-run`, the face's `/api/model-policy` and every reader of the file see the
same list):
- A class `profile:` that is not a string matching the ADR-1801 grammar.
- A class `profile:` on a row whose `[driver, ...fallback]` never reaches `generic-api`. The value would be inert,
  readable as decided while deciding nothing (the same doctrine as a partial tenure row).
- A `profile:` value in `models[tier][d]` for any `d` other than `generic-api`.
- A bare `profile:` with no name.

## Consequences

- One line per class gives the owner per-class gateways without a tier per gateway.
- `default:` is a row like any other. It may carry `profile:` under the same reachability rule.
- Every existing `router.yaml` row loads unchanged, because no row carries `profile:` today.
