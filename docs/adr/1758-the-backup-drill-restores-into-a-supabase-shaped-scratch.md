# ADR 1758 — the backup drill restores into a Supabase-shaped scratch

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a drill that restores into a Supabase branch or local Supabase stack instead of plain Postgres

## Context

The first real drill (`arc-sandbox`, 2026-10-14) dumped fine and failed the restore. The public schema's tables call
`extensions.gen_random_bytes` and `auth.uid()`, reference `auth.users`, and name the `anon`/`authenticated` roles in their
policies. None of that exists in a plain `postgres:17` scratch. Three more defects showed up the same day:

- GitHub answered the completed, green drill job with its steps still unconcluded, so verify read both steps as absent.
- `restore-drill` trusted backup's FIRST reported drill digest, not its newest.
- The pooler role for the dump cannot be granted the `auth` schema, because Supabase's `postgres` lacks the grant option there.

## Decision

Before `pg_restore`, the restore step gives the scratch that shape:

- it drops `public`;
- it creates `extensions` with `pgcrypto`;
- it creates `auth.users(id)` and stub `auth.uid()`, `auth.role()` and `auth.jwt()`;
- it creates the three roles.

The dump step also reads the source's user ids (ids only, never emails), through `launch_ops.user_ids()` when the role
cannot read `auth`, else directly. The restore copies them into `auth.users` so the foreign keys hold. The ids file is
removed with the dump.

Both drill verifies read a step with no conclusion as success only when the job itself concluded success: no drill step
continues on error. `restore-drill` uses backup's newest digest. On `arc-sandbox` the pooler role `launch_backup` (read
only, `bypassrls`) and `launch_ops.user_ids()` (security definer) were provisioned by hand through the Management API.
`backup` creating them itself, and setting `SUPABASE_DB_URL`, is owed.

## Consequences

Pinned by `launch-contract: a green drill job whose steps GitHub has not concluded yet counts; a red one never does`.
That test includes the `digest-moved` arm.
