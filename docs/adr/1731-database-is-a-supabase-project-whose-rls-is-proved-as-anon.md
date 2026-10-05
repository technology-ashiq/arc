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
owner role. verify asks the same endpoint, as `anon` inside one transaction, how many rows it can see: 0 while the owner
role sees 1 is the proof that RLS denies unless a policy grants. The down half (`drop table launch_probe`) is the exit
plan's step.

## Consequences

The query endpoint is Beta; a shape change breaks this verify loudly (a not-ok answer), never silently. The probe table
stays in the venture database until teardown.
