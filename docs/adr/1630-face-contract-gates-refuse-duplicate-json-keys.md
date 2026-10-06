# ADR 1630 — the face contract gates read their JSON through the duplicate-key check

**Status:** accepted
**Date:** 2026-10-06
**Product:** `org`
**Reversibility:** two-way

## Context
On 2026-10-05 main's `initiatives/face/contracts/expected-set.json` held the key `PLAN-launch` twice: PRs #317
and #318 each added it. `JSON.parse` keeps the last value silently, so `face-sections --check` and
`face-coverage` both passed, while every reader that checks the canonical form (`agent-scaffold`, `skill-import`)
refused main. It was found by accident (retro-log 2026-10-05, row 4). `core/json-strict.mjs`
`assertNoDuplicateKeys` already exists for exactly this and is used by `product-lint` and `arc-evolve`.

## Options considered
1. **A new lint over every JSON file in the repo**: a new mechanism, and most JSON here is generated.
2. **The two gates that already load the face contracts call `assertNoDuplicateKeys` before `JSON.parse`**:
   `face-sections.mjs` and `face-coverage.mjs` (`loadContract`, and their reads of `room-copy.json` and
   `rooms.generated.json`). Both already run on every CI job.

## Decision
Option 2. A duplicate key in any of the three face contract files fails both gates by name, with the key and
the file. Nothing else changes: the parsed value is the same object it was.

## Consequences
Easier: a key two lanes both add fails CI on the PR that adds the second one. Harder: nothing; a file with no
duplicate key reads exactly as before.
