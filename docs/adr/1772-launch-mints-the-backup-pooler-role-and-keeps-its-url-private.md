# ADR 1772 — `backup` mints its own pooler role; the URL goes to the owner's private dir, and the owner sets the secret

**Status:** accepted
**Date:** 2026-10-20
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the runner gains a governed way to set a GitHub Actions secret (libsodium sealed box, or an
allow-listed `ctx.run` closing debt D2). The one owner command below then becomes part of the apply.

## Context

REQ-17 (owner ruling 2026-10-20, kickoff Owed list): on `arc-sandbox`, the pooler role `launch_backup` and the
`SUPABASE_DB_URL` Actions secret were made by hand. Supabase's Management API can make the role over
`POST /projects/{ref}/database/query`, and `GET /projects/{ref}/config/database/pooler` names the session-pooler host
(read 2026-10-20: `database_type: PRIMARY`, `db_host: aws-0-<region>.pooler.supabase.com`; the session port is 5432 and
the user is `<role>.<ref>`, per Supabase's connection docs). Setting the Actions secret needs a libsodium sealed box,
which `node:crypto` lacks, and an adapter cannot run a process (ADR-1715, debt D2). `ctx.write` is confined to the
venture root, and on `myfitfolio` that directory is not a clone, so a credential written there could be committed later.

## Decision (owner fork, 2026-10-20: "Role auto, secret oru command")

- `pg-dump` makes `launch_backup`: login, `bypassrls`, select on `public` (with the matching `default privileges`), and
  `launch_ops.user_ids()` as security definer (ADR-1758). Its comment is launch's resource tag. If a `launch_backup` role
  exists without that tag, it is refused as `FOREIGN_ROLE` and never altered. If it exists with the tag, nothing is
  re-made.
- The password is 24 random bytes (base64url). It lives in the SQL request and in one file only:
  `ctx.writePrivate("SUPABASE_DB_URL", url)`. A new `ctx` writer confined to `{ARC_PRIVATE_DIR or ~/.arc-private}/launch/{slug}/`
  takes an env-style name only, writes with mode 0600, refuses a link, and returns the path, never the text. A provider
  error that quotes the password is masked before it leaves the adapter.
- The scaffold note gives the owner his one step: `gh secret set SUPABASE_DB_URL --repo {repo} < "{path}"`.
- Teardown drops the role and `launch_ops`, so the private URL stops working.

## Consequences

- `pg-dump` gains `SUPABASE_ACCESS_TOKEN` and `api.supabase.com`, and its bytes change, so it is a candidate until the
  owner re-vets it on `myfitfolio` (ADR-1705).
- `ctx.writePrivate` is a new trust-boundary surface. It is attacked with this phase's diff.

**Evidence:** Supabase Management API reference (`v1-get-pooler-config`); the live pooler answer on `arc-sandbox`
(field names only); ADR-1758; contract scenarios `role-made`, `role-foreign`, `role-echo-error`.
**Confidence:** medium (the role SQL is proven on a fake; its first live run is `myfitfolio`'s).
