# ADR 1613 — ORG-M: the org lives as its own product — `products/org` with data under `org/` and scripts under `.claude/scripts/org/`

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** After one cycle, more than half of org's scripts turn out to import `hq` internals rather than public exports -> fold into `hq` by ADR.

## Context
Open in the design source by design; the owner delegated it to this kickoff. Two homes: a new `products/org` product, or role cards under `hq` beside `ventures.yaml` (the org as a company organ like the ledger, which lives inside `hq`). `hq` already holds the spine, the inbox, the scheduler, the policy engine and the ledger. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **`products/org`** — manifest at `products/org/manifest.json`; cards at `org/roles/<dept>/<role>.role.yaml`, teams at `org/teams/<venture>.team.yaml`, map at `org/attribution.yaml`; scripts at `.claude/scripts/org/`.
2. **Inside `hq`** — governance files together, but `hq` grows again and `sync-to-project` cannot install the org without installing every hq organ.

## Decision
`products/org`. The reason that carried it: **REQ-07** — `sync-to-project --team` resolves products through `arc-products.mjs`; a separate product is installable, listable in the wiki and face as one entity, and its `requires:` states its dependency on `hq` (spine readers, jobs) and `core` (face-coverage walkers) explicitly. The docs lane took the same shape (ADR-1512). Data at root-level `org/` mirrors `ventures.yaml` at root: company data is not buried in a product folder.

## Consequences
Easier: clean install closure, clean wiki page, `hq` stops growing. Harder: a new product owes its face `expected-set` row, a `sync-golden` manifest line and a wiki regeneration in Phase 00's change.
