# ADR 1306 — FACE-G: the room birth-rule — `face:` manifest section + `face-coverage` lint

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** `product-lint` or `arc-products.mjs` rejects the `face:` section
despite the `evolve:` precedent (assumptions ledger row 3) → the face-side registry
carries all rooms and FACE-G is re-decided by ADR.

## Context

Every module has the same skeleton (purpose → pipeline → gates → receipts → decisions →
vocabulary → numbers). Thirty-two rooms must stay one product, and every FUTURE module
must land its own room without a redesign — coverage as a lint, not a hope ("onnu
vidama"). The `evolve:` manifest section is the exact precedent: a cross-cutting concern
declared per product, validated by `product-lint` `KNOWN_FIELDS`.

## Options considered

1. **`face:` manifest section + generic renderer + `face-coverage` lint (FAIL from
   birth)** — pros: a new lane's room exists the day its manifest lands; coverage is CI.
   Cons: `KNOWN_FIELDS` must be extended in the same change; unborn lanes need a
   registry.
2. **Rooms hand-registered in the L3 app** — cons: the 33rd room is a review comment
   someone forgets; coverage rots.

## Decision

Option 1. A module ships `face: { room, ring, kinds[], actors[], sanctioned[], stations[],
decisions[], numbers[], concepts[] }` in `products/<x>/manifest.json`; `product-lint`
`KNOWN_FIELDS` is extended **in the same change** (the `evolve:` precedent). The face
renders zones 1–6 generically from that; unknown kinds render generically as receipts
(kind-driven rendering). Rooms for unborn lanes (ops · trader · discover · chat-mcp) come
from a **face-side planned-rooms registry** sourced from their PLAN files — dotted, and
**no manifest is ever invented for an unborn lane**. Bespoke React panels register per
room id, inside zones, never as a new layout. `face-coverage` is a validator over the
tree (like `policy-lint`/`jobs-lint`) and starts at **FAIL from birth** — the named
exception to the WARN-first trial rule, because a coverage lint that warns is a hope.
Every future kickoff whose lane adds a kind or a gate lands its `face:` rows in the same
change (mirror of the POL-I birth rule).

## Consequences

Easier: 32 rooms, one template; the mutant-tree fixture (new lane + new kind → FAIL naming
both) is the negative control. Harder: this lane must write `face:` sections for all 16
existing manifests in Phase 05, and every later lane pays a small birth tax — by design.
