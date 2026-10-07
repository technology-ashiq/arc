# ADR 1734 — The login half is proved by probe users driving the live app, minted through the Supabase admin API

**Status:** accepted
**Date:** 2026-10-06
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Supabase removing `admin/generate_link`, or a venture whose auth is not email magic links

## Context

`auth` (login → session → logout), `authz` (a cross-tenant request returns 403) and `tenancy` (invite → join → scoped)
can only be proved by a person-shaped client using the deployed app. A real inbox cannot be read by an adapter, and a
verify that read its own files would prove nothing (ADR-1709). The `supabase-auth`, `rls-roles` and `org-invite` rows
could reach the live site and the Management API only.

## Options considered

1. **Read the magic-link email** — real / needs an inbox launch would have to own and poll.
2. **Mint the link through the admin API and follow it in the live app** — the app's own `/auth/confirm` route turns the
   token into a session cookie, exactly as it does for a person who clicked the email.

## Decision

Option 2. The three rows gain `<ref>.supabase.co` (`supabase.co`), `api.github.com`, `SUPABASE_ACCESS_TOKEN` and
`GITHUB_TOKEN`. Each verify reads the project's `service_role` key through the Management API per run, never stores it,
and uses it only against `<ref>.supabase.co/auth/v1/admin` to create probe users `launch-probe-{a,b,c}@<brand.domain>`
(email confirmed) and mint magic-link token hashes. Everything else is the live app, cookie by cookie, as a browser:

- `auth`: `GET /auth/confirm?token_hash=…&type=magiclink` sets the session; `GET /api/me` answers that user;
  `POST /api/logout` clears it; `GET /api/me` with the cleared cookies answers 401.
- `authz`: users A and B each own one org (`POST /api/orgs`, created once); A reading B's org answers 403, A reading
  its own answers 200.
- `tenancy`: A invites C into A's org (`POST /api/invites`); C accepts (`POST /api/invites/accept`); C reads A's org
  (200) and not B's (403).

scaffold commits each slot's routes through the Git Data API (ADR-1726) and runs its migration through the Management
API query endpoint (ADR-1731): `orgs` and `memberships` for `authz`, `invites` for `tenancy`, every table RLS-on with
policies that grant members only. `auth` also sets the project's `site_url`, redirect allow-list and magic-link template
(token-hash link to `/auth/confirm`), refusing when `site_url` already points elsewhere, and adds
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.example` (ADR-1729) for the owner to place.

`auth.depends_on` gains `frontend` (its routes live in the shell's repo). `authz` and `tenancy` see only their direct
dependency, so each slot re-reports the venture's repo and Supabase ref as `venture-repo` and `supabase-ref`, read from
its own upstream and validated there, never rebuilt.

## Consequences

The probe users and their orgs live in the venture database and appear in its user list; the exit plan deletes them.
Supabase's built-in mailer sends the magic link for real users (rate-limited); routing auth mail through Resend needs its
SMTP password in the Supabase config, a value launch does not write.
