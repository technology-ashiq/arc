# ADR 0401 — Pipeline truth lives on the company spine, not a venture's

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
**Revisit trigger:** a second venture runs its own outbound and the company spine becomes a
cross-tenant store rather than a company ledger.

## Context

`ADR-0059` gives each venture its own root-mode arc and its own spine, with only a passport
row at company level. Outbound sells *something* — in v1 plausibly a LexOS pilot. So which
spine carries `outreach.sent` and `deal.won`: the venture's, or the company's?

## Options considered

1. **Venture spine** — pros: the receipts sit next to the thing being sold. cons: "how many
   meetings did outbound book this month" needs a cross-repo join; RevOps has no home.
2. **Company spine** — pros: one ledger answers company revenue questions. cons: the
   venture's own repo cannot see its own pipeline without reading up.

## Decision

**Option 2.** Deals are company revenue and RevOps is a company organ (blueprint role #41).
The venture repo's root-mode spine keeps carrying its *build* receipts and nothing else.

## Consequences

**Easier:** one query answers pipeline questions across every venture outbound touches.

**Harder:** a venture cannot self-report its pipeline from its own repo. Accepted — the
passport row already establishes that direction of reference.

**Constrains:** `ADR-0400`'s kinds are added to the *company* `KINDS`, which is what makes
them visible to `/arc-report` and to evolve's later consumption.
