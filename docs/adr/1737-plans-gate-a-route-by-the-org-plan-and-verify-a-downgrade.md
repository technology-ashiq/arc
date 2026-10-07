# ADR 1737 — plans gates a route by the org's plan, and verify proves a downgrade closes it

**Status:** accepted
**Date:** 2026-10-07
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture with per-seat or usage plans, or a second gated feature that needs plan inheritance

## Context

The `plans` slot's exit criterion is "downgrade blocks a gated route", and REQ-04 asks that "a downgraded plan gets 403
on a gated route". `plans` depends on `authz` (ADR-1734), which leaves orgs, memberships, member-only RLS and the
probe browser: probe users signed in by admin-minted magic links, cookie by cookie. The `plans-yaml` row was written
at kickoff with only `sandbox.automemory.ai` in `hosts[]` and no keys, so it could probe the site but never write the
plan table or commit the route.

## Options considered

1. **Plan checks in the route only, from a hard-coded list** — no table. A downgrade then means editing code, and
   nothing billing writes could ever change it.
2. **A plan per org in the database, read under RLS; plans and their features in `plans.yaml`** — billing
   (`webhooks-ledger`, Phase 02) writes the plan, the route reads it, and verify changes it directly to prove that the
   gate follows the data.

## Decision

Option 2.

- **Row:** `plans-yaml` gains `api.supabase.com`, `supabase.co` and `api.github.com` in `hosts[]`, and the env keys
  `SUPABASE_ACCESS_TOKEN` and `GITHUB_TOKEN`, the same as `rls-roles`.
- **Migration** (marked `-- arc-launch migration: plans`): `public.org_plans (org_id uuid primary key references
  public.orgs on delete cascade, plan text not null check (plan in ('free', 'pro')), updated_at)`. RLS is on, and
  members can read their org's row (`is_member`). No role can write through PostgREST: writes come only from SQL run
  with the service role (billing, or launch's verify). The table carries the comment `arc-launch plans`, the same
  resume marker authz uses. A table of that name without the marker is the owner's and refuses `TABLES_FOREIGN`.
- **Files**, committed with this slot's trailer (authz's committer):
  - `plans.yaml` — the human-facing list: `free` (no features) and `pro` (`reports`).
  - `lib/plans.js` — the same list as code, so the app needs no YAML parser. The shell owns `package.json` (ADR-1733).
  - `app/api/reports/route.js` — the gated route. `GET ?org=<uuid>` gives 401 when signed out, 403 when the caller is
    not a member, 403 `plan does not include reports` when the org's plan lacks the feature, and 200 otherwise. A
    missing plan row counts as `free`.
- **verify** asks the live app. Probe user A signs in and owns `launch-probe-a` (found or created through
  `/api/orgs`). The verify then:
  1. sets that org to `pro` with SQL (the org id must be a uuid before it reaches SQL) and expects 200 from
     `/api/reports`;
  2. sets it to `free` and expects 403.

  The org ends on `free`. The evidence is `{ pro: 200, downgraded: 403 }`.
- **teardown:** drop `org_plans` (down migration, before authz drops orgs). The committed files are left to the
  venture.

## Consequences

- REQ-04's 403 clause is proven by `plans`, not by `checkout-portal`.
- `webhooks-ledger` sets `pro` on a paid order through the same table. That is its own slice and ADR.
- The probe org's plan is changed on every verify. Only the probe org: no customer's org is touched.
