# ADR 0001 — Postgres over SQLite

**Status:** accepted
**Date:** 2026-07-13
**Reversibility:** one-way
**Revisit trigger:** hosting bill exceeds $25/mo or migration effort estimate exceeds 2 days

## Context
Need a persistent store the platform can host; schema will grow past a toy.

## Options considered
1. **Postgres** — managed, migrations, room to grow / slightly more setup
2. **SQLite** — zero setup / no managed hosting on target platform, migration later is one-way pain

## Decision
Postgres — the target platform hosts it managed, and leaving SQLite later is the expensive door.

## Consequences
Easier: growth, backups. Harder: local dev needs a container. Revisit if the bill trigger fires.
