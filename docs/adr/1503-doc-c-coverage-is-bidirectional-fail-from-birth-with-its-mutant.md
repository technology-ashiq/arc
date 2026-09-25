# ADR 1503 — DOC-C: coverage is bidirectional and FAIL-FROM-BIRTH, with `--mutant-selftest`

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** `--mutant-selftest` exits 0 on a tree it should reject, at the day-3 checkpoint or on any later CI run → the cycle STOPs (kill criterion) and the finding is recorded before anything else is built.

## Context

Locked (DOC-C). Modelled on `face-coverage.mjs`, which is FAIL-FROM-BIRTH — a named exception to
the WARN-first trial rule because "a coverage lint that only warns is a hope" — and whose
`--selftest` runs mutant trees that must FAIL naming what they planted. `face-coverage` checks one
direction (thing with no room). The wiki needs both.

## Options considered

1. **WARN-first trial, promote later** — the gate *is* REQ-01..03; a warning certifies nothing.
2. **FAIL-FROM-BIRTH, one direction** — orphan pages (a product deleted, its page kept) would lie with authority.
3. **FAIL-FROM-BIRTH, both directions, with a mutant self-test** — the design source's rule.

## Decision

Option 3. `.claude/scripts/docs/wiki-coverage.mjs`:

- **Entity → page:** every entity in `wiki.json` has its page file; a missing one FAILs naming it.
- **Page → entity:** every generated page under `docs/wiki/` and every narrative file under
  `docs/wiki/_narrative/` maps to an entity in `wiki.json`; an orphan FAILs naming it.
- Exit `0` covered · `1` a finding · `2` usage / unreadable input (never 0 on unreadable).
- `--mutant-selftest` builds **scratch-copy** mutant trees (never the live tree, cleaned up on every
  path) and asserts each FAILs naming exactly what was planted: (M1) an unknown product **and** an
  unknown lane → FAIL naming BOTH; (M2) a product directory removed with its page left → FAIL
  naming the orphan page; (M3) an orphan narrative file → FAIL naming it; (M4) the wiring mutant —
  `treeWorld` disconnected so it returns an empty inventory — must FAIL, not print "0 … covered"
  (the `gather` seam face shipped once, `b0f3a4ef`). Expected failures are labelled as expected so
  the self-test's own output never turns CI red by looking like a failure (face `182d155c`).
- The self-test also asserts it RAN: it prints a count of mutants executed, and the bats suite
  asserts that count equals the number declared, before asserting any verdict (the vacuous-pass
  rule, `.claude/rules/testing.md`).

## Consequences

Phase 01 is built and proven against **fixture trees** before any renderer exists, so the renderer
in Phase 02 is written against a proven invariant. Day 3 (end of Phase 01) is the kill checkpoint.
