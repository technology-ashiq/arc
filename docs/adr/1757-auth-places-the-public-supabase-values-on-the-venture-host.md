# ADR 1757 — `auth` places the public Supabase values on the venture's host

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a host other than Vercel for the venture app, or a Supabase key model where the browser key is no longer public

## Context

On the first real `auth` run (`arc-sandbox`, 2026-10-14) every `/auth/confirm` answered 500: "Your project's URL and
Key are required to create a Supabase client". `.env.example` named `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, but nothing ever set them on the Vercel project, and `secrets` only checks names. The
same run showed GoTrue now answers `generate_link` with `hashed_token` at the top level beside the user, not inside
`properties`, so every probe in five adapters read an empty token.

## Options considered

1. **Leave both values to the owner** — no code / a manual copy of two values that every browser already receives, and a login that cannot work until it is done.
2. **`secrets` places them** — one place for env / `secrets` runs before `database` exists, so it has nothing to place.
3. **`auth` places them, before its commit** — it already reads the project and its keys / `auth` gains `VERCEL_TOKEN` and `api.vercel.com`.

## Decision

Option 3. Before it commits the routes, `auth` finds the Vercel project by the repo's name. It refuses one linked to
another repo (FOREIGN_PROJECT). For each of the two names not already set for production, it creates a plain
production+preview variable with the project URL or the anon key, and reports it as `vercel-env`. A value the owner
already set is kept. `NEXT_PUBLIC_` values are baked at build time, so when it placed a value and its commit pushed
nothing, it asks Vercel for a production build of `main`. Teardown deletes the variables it reported. The probes in
`auth`, `authz`, `tenancy`, `plans` and `checkout-portal` read `hashed_token` from the top level or from `properties`.

## Consequences

Pinned by `launch-contract: auth places the public Supabase URL and anon key on Vercel, keeps the owner's, rebuilds when
nothing was pushed (ADR-1757)` and `launch-contract: the auth probe reads a minted token at the top level and in
properties`.
