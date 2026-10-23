# ADR 2205 — The venture CI template goes ubuntu-only, filed to the launch lane

**Status:** accepted
**Date:** 2026-10-24
**Product:** `ci`
**Reversibility:** two-way
**Revisit trigger:** a venture ships a native binary or an OS-specific dependency.

## Context

Locked letter CI-P. `products/launch/providers/ci/github-actions.mjs` writes a 3-OS (`LEGS = [ubuntu, windows, macos]`) push + PR workflow into every venture repo. The file belongs to the LIVE `launch` lane by manifest-derived ownership (ADR-0057).

## Options considered

1. **Edit it from the ci lane.** That breaks lane ownership.
2. **File it as `/arc-change --lane launch`.**

## Decision

Option 2. The change is `LEGS = ["ubuntu-latest"]`, Node 24, `pull_request` + `push: main`, concurrency and draft skip, along with its `verify` required-check list and its tests. The handoff is written in Phase 01. Its merge and its proof (the launch suite) are launch's, not a ci REQ. On any tie, the venture track outranks this cycle.

## Consequences

This touches the "all three legs" wording in ADR-1726/1733/1744, which launch amends in its own change.
