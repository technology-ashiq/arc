# ADR 1756 — `auth` sends the login email through the venture's Resend domain

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Supabase lets a free-tier project change its email templates on its own mailer, or a venture whose transactional email is not Resend

## Context

The first real `auth` run (`arc-sandbox`, 2026-10-14) failed twice. First, a project never edited answers Supabase's
default magic-link text from its config API, not an empty string, so `auth` read it as the owner's own template and
refused (TEMPLATE_FOREIGN). Second, once that text counted as stock, the PATCH that writes launch's template (the link
that lands on `/auth/confirm`) came back 400: "Email template modification is not available for free tier projects using
the default email provider." Without that template the magic link never reaches the venture's own confirm route, so
login cannot work on a free-tier project at all.

## Options considered

1. **Upgrade the Supabase plan** — no code / a monthly cost for every venture before it has a user.
2. **Leave Supabase's template and confirm on Supabase's own URL** — no SMTP / the session cookie is set on Supabase's domain, not the venture's; the probe and the `@supabase/ssr` routes do not work that way.
3. **Point the project's SMTP at the venture's Resend domain** — `email-transactional` already verified that domain, and `auth` already depends on it / the Resend key is stored in Supabase's auth config.

## Decision

Option 3, chosen by the owner. `auth` treats Supabase's default magic-link text (current and earlier wording, compared
whitespace-insensitively) as stock. When it writes the template and the project has no SMTP host, it sets
`smtp.resend.com:465`, user `resend`, the venture's `RESEND_API_KEY` as the password, sender `login@<brand domain>`. That
needs a Resend domain reported by `email-transactional` (otherwise UPSTREAM_MISSING), and a key of Resend's shape. An
SMTP host the owner set is theirs and kept. The key goes only in the PATCH body and the config API never answers it back.
`supabase-auth` gains `RESEND_API_KEY`.

## Consequences

The login email also leaves Supabase's hourly send limit behind. Pinned by `launch-contract: Supabase's own default
magic-link email is stock and replaced; one word changed is the owner's` and `launch-contract: on the free tier auth
sends the login email through the venture's Resend domain (ADR-1756)` (the free-tier fake refuses a template on
Supabase's own mailer, as the real API does).
