# ADR 1912 — The `venture.yaml` acceptor is launch's `loadProfile()`, not `launch-lint`

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** launch adds a profile check outside `loadProfile()`. Then REQ-06's fixture calls that check too, in the same PR.

## Context

The design source's REQ-06 says "`launch-lint` PASSES". Kickoff verification: `.claude/scripts/launch/launch-lint.mjs` lints the slot catalog, the provider registry and adapters, and never reads a venture profile. The profile is validated by `loadProfile(slug, venturesDir)` in `.claude/scripts/launch/lib/catalog.mjs:60`, which checks the slug grammar, Windows reserved names, `slug` equality and the `PROFILE_FIELDS` enums. `resolveBoard()` then derives the board.

## Options considered

1. **Ask launch to add profile linting to `launch-lint`.** It matches the wording, but it is a launch change made for discover's convenience.
2. **Call launch's real acceptor.** The CI fixture imports `loadProfile` and `resolveBoard` and runs them on the exporter's output.

## Decision

Option 2. REQ-06's acceptance is that `loadProfile(<slug>)` returns without throwing and `resolveBoard(loadCatalog(), profile)` resolves, both imported from launch and never copied. They run in CI on a fixture hunt's output, plus one negative fixture whose injected value must make `loadProfile` throw `SHAPE`.

## Consequences

A contract change in launch's profile turns discover red the same day (pre-mortem #3).
