# ADR 1367 — FV3-K: an agent's tier is implied by its `model:` through router.yaml, read-only

**Status:** accepted 2026-10-21 by the owner at the Cycle 17 kickoff (fork 3, "Derive from model:")
**Lane:** face (Cycle 17) · **REQ:** REQ-08 · **Phase:** 03
**Reversibility:** one-way
**Revisit trigger:** an agent's tier must differ from what its model implies (then a `tier:` key and a disagreement lint, as an ADR-0069 reviewed diff)
**Bound by:** ADR-0069 (tiers are law; a tier change is a reviewed diff) · ADR-1327

## Context

The agents room shows "High-judgment tier — not served" and "Switched on — not served". `.claude/agents/*.md` carry only `model:`; tiers belong to task classes in `engine/router.yaml`.

## Options considered

1. **`/api/roster` gains a tier per agent, inverted from router.yaml's model→tier map; an unmapped model reads `unmapped`, never a guess (chosen).**
2. **A `tier:` key on every agent file** — ~30 files, a schema change, a disagreement lint.

## Decision

Read-only field on an existing route; labelled "implied by model:" in the room.

## Consequences

- Cannot drift from router.yaml; cannot express an agent whose tier differs from its model.
