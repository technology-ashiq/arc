# ADR 0005 — Mutation score replaces coverage as the primary test-quality gate

**Status:** accepted · 2026-07-09

## Context
Coverage % is gameable — AI agents routinely generate assertion-free tests that execute lines without verifying behavior. A coverage gate therefore measures effort, not quality. Mutation testing (Stryker) kills this: a surviving mutant proves a test verifies nothing.

## Decision
Diff-scoped Stryker mutation score becomes the primary test-quality gate (CI tier); `coverage-gate.sh` is demoted to a secondary/advisory check. Full-repo mutation runs nightly for trend data, never gating.

## Consequences
+ AI-generated fake tests become detectable automatically — a differentiator no known AI-coding stack has.
+ Evidence bundles carry an unfakeable quality number.
− CI time cost (bounded by diff-scoping); JS/TS only this cycle.
− Mutation score thresholds need per-project tuning via the ratchet profiles (Phase 5).
