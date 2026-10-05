# ADR 1724 — Real-provider steps use arc's existing free accounts and owner-placed tokens; a missing one REFUSES

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a vet or apply run that would incur cost

## Context

Read 2026-10-03: `gh` is logged in with `repo` scope; the Supabase CLI is logged in; the Vercel CLI token is invalid; no Cloudflare or Razorpay key is on the box. Under LAU-M launch never fetches a key.

## Options considered

1. **Buy or create paid accounts** — fewer blocks / money spent on a rehearsal.
2. **Free tiers of existing accounts; the owner places scoped tokens; a missing token is `failed(env:<KEY>)`**.

## Decision

Option 2. Phase 00 needs no token (fakes only). Before Phase 01 the owner places `CLOUDFLARE_API_TOKEN` (DNS edit, zone automemory.ai), a valid `VERCEL_TOKEN`, and before Phase 02 `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test mode). A run that would cost money goes to the owner first.

## Consequences

A phase whose token is absent closes its slot as REFUSED or named ABSENT; it is never faked.
