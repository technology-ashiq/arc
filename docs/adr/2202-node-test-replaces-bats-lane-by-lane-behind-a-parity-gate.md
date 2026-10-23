# ADR 2202 — `node:test` replaces bats, lane by lane, behind a parity gate; tests mirror the source

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** one-way
**Revisit trigger:** the §11 kill line: `org` under `node:test` is not ≥ 5x faster than under bats on the owner's box.

## Context

Locked letters CI-E, CI-F, CI-G and CI-H. The suite makes 1,774 `run node` calls against 23 bash-script runs. Every bats `run` spawns a process: 2.82 s/test on Windows vs 0.26 s on Linux. 255 of 312 `.claude/scripts/**/*.mjs` already export functions a test can import. The hand-typed floor (911) guards nothing against 4,815 tests.

## Options considered

1. **Keep bats.** It costs nothing to migrate, but local runs stay impossible.
2. **`node:test` (built in, zero dependencies), lane by lane, under §6.** That gate requires count ≥ old, both suites green, a committed name map and a negative control.

## Decision

Option 2. Tests live in `tests/<lane>/*.test.mjs`, mirroring `.claude/scripts/<lane>/` and `products/<lane>/`, still centralised under `tests/`. Each lane has a `tests/<lane>/.count`, compared against the runner's reported count: lower fails, higher prints the number to commit. Until a lane migrates, `tests/bats.count` carries the bats total. Lanes migrate in the order HQ core → build machinery → security scanners → business. `gate-parity.mjs` learns the `.test.mjs::name` merge-time form before any pinned bats file moves.

## Consequences

This amends ADR-0021 (the layout, not the centralisation) and supersedes ADR-0007's bats-core choice when Phase 04 ends. It is one-way because deleted `.bats` files come back only through git history, and the name maps are the audit trail.
