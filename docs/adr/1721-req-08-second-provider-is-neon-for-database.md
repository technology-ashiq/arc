# ADR 1721 — REQ-08's second provider is `neon` for `database`

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

REQ-08 falsifies the dynamic claim with a real second provider. Candidates: `neon` (database) or `cloudflare-workers` (hosting).

## Options considered

1. **neon for database** — free tier, narrow surface, a failed vet cannot threaten the day-3 kill line / adds a second Postgres account.
2. **cloudflare-workers for hosting** — tests the riskiest slot / entangled with tls, environments and the git-triggered deploy.

## Decision

Option 1. If neon's vet fails inside Phase 04's clock, the fallback is `cloudflare-workers`; if both fail, REQ-08 ships its CI contract plus a fixture provider (assumption A-06).

## Consequences

Phase 04 adds one row and one file under `providers/database/`.
