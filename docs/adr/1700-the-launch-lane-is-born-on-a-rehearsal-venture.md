# ADR 1700 — The `launch` lane is born, and its dogfood is the rehearsal venture `arc-sandbox`

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a real venture's `venture.yaml` (honesty_class: real) arrives through PLAN-discover or the owner's hand

## Context

On 2026-10-03 the owner chose the `launch` lane first, after a full-tree analysis showed three of five links of the money chain missing while every governance organ was complete. The owner set two conditions in the same ruling: the process is fixed, and every tool is dynamic. In the same round the owner ruled out Nilluvai: there is no venture idea on the table.

## Options considered

1. **Dogfood on a real venture** — the strongest proof / no venture idea exists; inventing one dresses `revenue.simulated` as a business (rabbit hole 8).
2. **Dogfood on a rehearsal venture `arc-sandbox` at `sandbox.automemory.ai`** — proves the machine, not a favour to one venture / no real revenue this cycle (REQ-12 stays OPEN-at-first-venture).

## Decision

Option 2. The lane is born at `initiatives/launch/`, claims ADR century 1700-1799 (swept: no ADR >= 1700 on any worktree or remote branch on 2026-10-03), and every receipt `arc-sandbox` emits is classed `rehearsal`, never `real`.

## Consequences

Gates 1 (domain purchase) and 3 (payment-live keys) are exercised through their refusal paths only. Gate 2 (first prod deploy) is crossed for real on the subdomain. The first real `revenue.received` (REQ-12) is recorded OPEN-at-first-venture.
