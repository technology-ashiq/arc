# ADR 1909 — DIS-I: discover is a venture-scope lane; the company organs stay single

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source (DIS-I). Fired by the owner ruling (ADR-1900). ADR-0053 keeps the ADRs, retro-log and tests at the repo root.

## Options considered

1. **Lane-local tests and ADRs.** Tidy, but invisible to CI's shard map and the wiki.
2. **The company organs at root, with only plan and evidence per lane.**

## Decision

Option 2. ADRs go in `docs/adr/19xx-*`. Tests go in `tests/discover-*.bats`, with node helpers in `tests/discover/`. Evidence goes in `initiatives/discover/evidence/phase-NN/`. The product shape copies org's (ADR-1613): `products/discover/manifest.json`, scripts under `.claude/scripts/discover/`, and the command `/arc-hunt`.

## Consequences

The product birth rows (manifest, CATALOG, face room, face-sections, sync golden, then the wiki last) land in Phase 00's PR.
