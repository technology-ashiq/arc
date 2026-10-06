# ADR 1904 — DIS-D: polite fetch, public endpoints only

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** one-way
**Revisit trigger:** never by convenience. Only an owner ruling that names a specific source and its terms can reopen this.

## Context

Locked in the design source (DIS-D). Fired by the owner ruling (ADR-1900). Reputation is a company asset, and a scraped login wall cannot be unscraped.

## Options considered

1. **Whatever works.** More signal, but terms violations.
2. **Polite fetch:** 1 request per second, an identified UA, public endpoints, robots respected, and no login-walled scraping.

## Decision

Option 2. The pacing and UA live in the miner wrapper, not in growth's adapter. Before any non-HN source is added, a robots preflight runs through the design lane's existing `design-robots.mjs`, which is imported.

## Consequences

The source set is small, and that is deliberate (no-go: no multi-source in v1).
