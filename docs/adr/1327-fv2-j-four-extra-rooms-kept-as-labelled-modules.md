# ADR 1327 — FV2-J: the four `extra` rooms are kept as modules, labelled and exempted by name

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner rules (PLAN-face-v2 §13 item 5, before Phase 05) that `story` and/or `factory` earn a registry row → that room's exemption is deleted in the same change that adds its row.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-J — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff.

## Context

`factory` · `executor` · `agents` · `story` exist in v0.7 and not in arc's served registry.
ADR-1321 FAILs a module whose id is not served.

## Options considered

1. **Ship them as modules with a not-in-registry badge, exempted by name in `face-coverage`.**
2. **Delete them to satisfy the lint** — rejected in PLAN-face-v2 §10: the owner's rooms outrank the lint's tidiness.
3. **Silently skip them in the check** — an unnamed exclusion is the decay pattern retro-logged 2026-08-24.

## Decision

Option 1. Each exemption names the room id and this ADR; a fifth unnamed exemption FAILs.

## Consequences

- `face-coverage`'s exemption list goes from empty to exactly four named rows; its selftest proves a fifth, unnamed one FAILs.
