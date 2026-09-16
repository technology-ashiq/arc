# ADR 1332 — Cycle 16's tracker starts at Phase 00, and Cycle 15's tracker and evidence move to the lane archive

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** `arc-evidence` or `/arc-phase-done` learns to scope bundles by cycle → the archive split is no longer needed for future cycles; or a test starts asserting that no tracked file lives under `initiatives/*/archive/` → reconcile with the engine and develop archives, which predate it.
**Provenance:** decided at the Cycle 16 kickoff (two-way door — recorded, not asked).

## Context

The owner's instruction numbers this cycle's phases P00–P07 ("Cycle 15's REQ-10 is carried here
as Phase 07"). Cycle 15 already holds `initiatives/face/phases/phase-00…09-spec.md` and evidence
bundles at `evidence/phase-00/`, `phase-03/` and `phase-09/`. `.claude/scripts/plan/arc-evidence.sh`
refuses to write into a bundle whose manifest names a different commit, so this cycle's Phase 00
and Phase 03 closes would be refused if the old bundles stayed in place.

## Options considered

1. **Archive in the lane, engine precedent:** `initiatives/face/archive/PLAN-cycle15-2026-09-16.md`, `PROGRESS-cycle15-2026-09-16.md`, `phases-cycle15-2026-09-16/`, `evidence-cycle15-2026-09-16/phase-{00,03,09}/`.
2. **Continue Cycle 15's numbering (Phases 10–17)** — contradicts the owner's "Phase 07" and PLAN-face-v2's P-numbers.
3. **Archive to `docs/archive/`** — that tree is frozen pre-portfolio history (ADR-0058); lanes do not write there.

## Decision

Option 1, done at kickoff so the tracker never holds two cycles' specs at once. No reference in
the repo pointed at the moved evidence paths (checked with `git grep` 2026-09-16); the archived
PROGRESS keeps its own relative links, which now resolve inside the archive.

## Consequences

- Carried Cycle 15 findings (room sweep F1–F3) are now cited at `initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md`.
- Recorded, not fixed: `tests/portfolio-board.bats` asserts `git ls-files -- 'initiatives/*/archive'` counts 0, but that pathspec matches no file (3 tracked lane-archive files existed before this cycle and the test stays green). The assertion is vacuous; tightening it would turn engine, develop and now face red. It belongs to the portfolio lane via `/arc-change`.
