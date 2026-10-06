# ADR 1733 — The shell owns the venture's dependency manifest; later slots add files, and CI is their typed check

**Status:** accepted
**Date:** 2026-10-06
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a slot that needs a dependency the Phase 01 manifest does not carry

## Context

`backend` (zod contract, `/health`) and `orm` (typed schema) write venture code that needs packages. If each slot edited
`package.json`, a re-run of one would rewrite the others' lines (every writer checks its own content, ADR-1726), and the
file would flap between slots. `orm`'s exit criterion, "typed schema generated", needs an answerer outside the repo: a
schema file existing proves nothing (ADR-1709).

## Options considered

1. **Each slot edits `package.json`** — local / the file flaps between writers.
2. **The shell's `package.json` carries Phase 01's dependencies; later slots add files only** — one owner per file.

## Decision

Option 2. The `frontend` shell's `package.json` lists `next`, `react`, `react-dom`, `zod`, `drizzle-orm`,
`@supabase/supabase-js` and `@supabase/ssr`, and its `test` script is `node --test`. `backend` commits
`lib/contract.js` (the zod schema of `/api/health`) and `app/api/health/route.js`, which validates its own answer
against it; its verify reads `https://<domain>/api/health` and checks the answer's exact shape. `orm` commits
`db/schema.js` (drizzle `pgTable` for `launch_probe`, matching ADR-1731's table) and `db/schema.test.js`, which asserts
the table's columns under `node --test`; its verify asks GitHub for the `arc-ci` run of `main`'s head with all three legs
green while `db/schema.js` is in that commit. Both rows gain `api.github.com` and `GITHUB_TOKEN`, and `orm.depends_on`
gains `frontend`: the schema is written into the shell's repo, beside its manifest.

## Consequences

"Generated" here means written from the probe table's known shape and type-checked on CI, not introspected from the live
database: introspection needs a connection string launch does not hold (ADR-1731). A venture that adds tables extends
`db/schema.js` itself.
