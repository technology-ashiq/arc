# ADR 1713 — LAU-M: secrets never touch the repo; launch never fetches a key

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** never — a key in git is unrecoverable

## Context

E2 human sovereignty: the owner places keys. The arc repo is public. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **launch provisions keys via provider APIs** — automatic / the machine holds the owner's credentials.
2. **`envContract()` returns key names; `apply` prints them and waits**.

## Decision

Option 2. `.env.example` is generated from the union of contracts and linted against it; gitleaks runs in the venture's CI from its first commit. A missing key is `failed(env:<KEY>)`, never a prompt for the value.

## Consequences

Every real-provider step is blocked until the owner places a key, and says which.
