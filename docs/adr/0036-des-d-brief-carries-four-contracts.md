# ADR 0036 — DES-D: the brief carries four contracts; coverage is contract-driven, tier sets effort only

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** two consecutive briefs where a whole section is boilerplate (filled to pass lint, never referenced by critique) — section earns deletion or merge.

## Context

Post-hoc review can fix padding; it can never fix the wrong screen. The reviewer needs
declared intent to review against. Superseded-record row 7 killed tier-based device
coverage.

## Options considered

1. **Four required contracts** — interaction model (7 answers) · art direction (taste = decision, recorded as design ADRs) · platform contract (per-surface yes/no table) · content contract (vocabulary, voice, density). All design-lint-checked. Con: brief-writing overhead per build.
2. **Freeform brief** — fast. Con: unlintable, uncheckable, critique has no anchor.
3. **Tier-based coverage rules** — simple. Con: blunt; a mobile-first S-tier product gets desktop-only review.

## Decision

Option 1. The critic verifies EXACTLY what the platform contract declares — nothing
skipped, nothing padded. Tier (S/M/L) governs effort depth only (S = brief-lite +
review · M = +explore 2-3 variants · L = full + deeper critique).

## Consequences

Easier: critique is defect-vs-contract, never vibes; coverage disputes are settled by a
table. Harder: UI-bearing builds pay a brief up front — that cost IS the product.
