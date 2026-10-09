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
  dispatch and weekly, as ONE job `drill`, so the dump never leaves the runner (attack b6ffd12 B7):
  - step `dump and checksum` runs `pg_dump -Fc --schema=public` from a `postgres:17` container, over the owner's
    `SUPABASE_DB_URL` Actions secret, and writes the dump's sha256 and each table's source row count;
  - step `restore and compare row counts` checks the sha256, `pg_restore`s into a scratch `postgres:17` service (trust
    auth, localhost only, no password anywhere), counts again, and `diff`s against the source counts. It fails unless
    every table's count matches and there is at least one table;
  - a last step removes the dump, always. Nothing is uploaded.
- backup's verify checks three things: the file is launch's at main's head; the secret exists by name; and the newest
  drill run on main that ran launch's file byte for byte (cancelled and skipped runs passed over) is under eight days
  old with both steps `success` (b6ffd12 B6). backup reports the file's sha256 as `drill-digest`.
- **restore-drill** creates nothing. Its verify is the same run's restore step, chosen by the same rule against
  backup's `drill-digest`, so it never trusts a drill file launch did not write (b6ffd12 B5).
- `backup` gains `depends_on: orm`, because the repo name comes from orm's report. Both slots are core, and the DAG
  stays acyclic.
- Rows: `GITHUB_TOKEN` and `api.github.com` only. Launch never reads the database URL. The owner sets the secret with
  `gh secret set SUPABASE_DB_URL`.

## Consequences

- D2 stays closed: no adapter runs a process. GitHub's runner answers the drill, outside this repo, as it does for ci
  and orm.
- If the drill's weekly schedule stops, both slots go not-ok after eight days. A receipt is never older than a week
  and a day.
