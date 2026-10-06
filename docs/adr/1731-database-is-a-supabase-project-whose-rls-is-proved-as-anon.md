# ADR 1731 — `database` is a Supabase project whose RLS is proved by reading as `anon`

**Status:** accepted
**Date:** 2026-10-06
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Supabase retiring the Management API's `database/query` endpoint (Beta), or a venture on a paid plan

## Context

The `database` exit criterion is "up/down fixture; RLS denies unless a policy grants". The Management API can create a
project but sets its database password at creation and never returns it, and LAU-M forbids launch holding a secret.
Projects carry no description, so a launch-made project cannot carry a marker the way a repo does (ADR-1722).

## Options considered

1. **Store the generated password in the Vercel env store** — the app can connect directly / launch writes a value, which
   ADR-1729 forbids.
2. **Generate it, use it once at creation, record it nowhere** — the app uses the project's API keys (read when a later
   slot needs them, never stored by launch); the owner resets the password in the dashboard when a direct connection is
   wanted (Phase 03 backup).

## Decision

Option 2. The project is named after the venture slug in the token's only organization (several → refused by name, never
picked); region follows `profile.region` (`in` → `ap-south-1`). A project of that name already present is recorded as
`supabase-project-found` and left out of the exit plan. scaffold then runs one migration through
`POST /v1/projects/{ref}/database/query`: table `launch_probe` with RLS enabled and NO policy, one row inserted as the
owner role. verify counts the rows as the owner role through the same endpoint (1), and reads the table the way the
venture's app will: PostgREST at `<ref>.supabase.co` with the project's public anon key, read per verify and never stored
(0 rows). That pair is the proof that RLS denies unless a policy grants. The row gains `supabase.co`. (A role switch
inside a Management API request was the first form; it left the session's transaction and role open.) The down half (`drop table launch_probe`) is the exit
plan's step.

## Consequences

The query endpoint is Beta; a shape change breaks this verify loudly (a not-ok answer), never silently. The probe table
stays in the venture database until teardown.
