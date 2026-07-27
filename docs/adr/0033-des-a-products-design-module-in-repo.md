# ADR 0033 — DES-A: design ships as `products/design/` module in-repo, never a separate repo

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** one-way
**Revisit trigger:** arc itself splits into multiple repos, or a paying external consumer needs the design module standalone without the rest of arc.

## Context

Design capability needs a home. Everything it depends on — gates (`arc.gates.yaml`),
the event spine, the review-ledger, sync-to-project, product-lint — lives in the arc
repo. Decision consolidated in `docs/strategy/plans/PLAN-design.md` Part 4 (frozen
2026-07-26, 4 spec rounds).

## Options considered

1. **`products/design/` module in-repo** — full access to gates/spine/ledger/sync; installs selectively like every other product; single sync story. Con: repo grows.
2. **Separate repo** — clean boundary. Con: gates, spine receipts, ledger stamps, sync-to-project all cross a repo boundary; every integration becomes an API.

## Decision

`products/design/manifest.json` module inside arc, moving design assets out of
`products/qa/` (migration governed by ADR-0042). The carrying reason: the module's whole
value is that design plugs into arc's existing verification machinery — receipts, stamps,
gates — which is in-repo. Public/SaaS differentiator stays intact: no other AI dev
framework ships a design gate.

## Consequences

Easier: receipts, gate wiring, ledger stamps, selective install, one CI. Harder: the
module can never be versioned/shipped independently without extraction work
(demand-triggered extraction pattern, ADR-0016, applies if that day comes).
