# ADR 1746 — backup and restore-drill run as one drill workflow on the venture's CI, verified by its job conclusions

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** launch gains a `ctx.run` that kills the process tree (debt D2), or Supabase's own backups expose a
restore API

## Context

REQ-06: "`backup` = `pg_dump` over the session pooler restored into a scratch Postgres with every table's row count
equal". ADR-1709 says a backup is verified only by that restore. An adapter cannot run a process (ADR-1715), and debt
D2 names the first subprocess as the trigger for a process-tree kill. The kickoff rows carried `SUPABASE_DB_URL` and
the pooler host, which only make sense for a subprocess on this box.

## Decision

- **backup** commits `.github/workflows/backup-drill.yml` to the venture repo. It runs on a push of that file, on
  dispatch and weekly, with two jobs:
  - `backup` runs `pg_dump -Fc --schema=public` from a `postgres:17` container, over the owner's `SUPABASE_DB_URL`
    Actions secret. It writes the dump's sha256 and each table's source row count, and uploads all three.
  - `restore` (needs `backup`) checks the sha256, `pg_restore`s into a scratch `postgres:17` service, counts again,
    and `diff`s against the source counts. It fails unless every table's count matches and there is at least one
    table.
- backup's verify checks three things: the file is launch's at main's head; the secret exists by name; and the newest
  completed drill run on main is under eight days old with both jobs `success`.
- **restore-drill** creates nothing. Its verify is the same run's `restore` job, under the same age rule.
- `backup` gains `depends_on: orm`, because the repo name comes from orm's report. Both slots are core, and the DAG
  stays acyclic.
- Rows: `GITHUB_TOKEN` and `api.github.com` only. Launch never reads the database URL. The owner sets the secret with
  `gh secret set SUPABASE_DB_URL`.

## Consequences

- D2 stays closed: no adapter runs a process. GitHub's runner answers the drill, outside this repo, as it does for ci
  and orm.
- If the drill's weekly schedule stops, both slots go not-ok after eight days. A receipt is never older than a week
  and a day.
