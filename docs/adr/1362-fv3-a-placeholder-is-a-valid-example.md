# ADR 1362 — FV3-F: a placeholder is a valid example of its own field

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-F), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** a field's valid example would leak something private (a real key, a client name) — then the example is synthetic and says so
**Bound by:** ADR-1339 (the work door's `validateInput`)

## Context

13 of 32 ops rejected their own placeholder: placeholders were descriptions ("the venture's slug, lowercase"), so typing what the form showed was refused.

## Options considered

1. **Every placeholder passes the door's own `validateInput` (chosen).**
2. **Keep descriptions, add a hint line** — the schema has no hint field; adding one is a contract change.

## Decision

Placeholders in `.claude/scripts/hq/face-ops.mjs` are valid examples; a node check calls `validateInput` on each.

## Consequences

- 32/32 ops plan 200 with their own placeholders. The sync golden moved one row (`face-ops.mjs`).
