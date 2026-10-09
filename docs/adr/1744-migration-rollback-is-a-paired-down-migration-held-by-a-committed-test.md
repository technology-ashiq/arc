# ADR 1744 — migration-rollback is a paired down migration held by a committed node test that arc-ci runs

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the venture adopts drizzle-kit migrations, or a migration needs a down that is not a drop

## Context

The exit criterion is "fixture". The orm slot proves its schema with a `node --test` that arc-ci runs on three legs
(ADR-1733). The venture's one dependency manifest has no migration tool.

## Decision

- The adapter commits three files:
  - `db/migrations/0001_launch_probe.sql`, the up migration.
  - `db/migrations/0001_launch_probe.down.sql`, the down migration.
  - `db/rollback.test.js`, which holds every migration in the directory to one rule: an up has a down, and the down
    drops every table the up creates, in reverse order. It uses only `node:` built-ins and runs on Node 18 and later.
- verify checks that the files are launch's at main's head. It then requires arc-ci's run for that head to be green on
  all three legs, so the fixture ran outside this repo.
- The contract suite also runs the committed test itself. It passes on the committed files and fails on a down that
  drops nothing, so the fixture is proven to bite.
- Upstream: `orm` names the repo.
