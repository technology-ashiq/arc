# ADR 0001 — Build arc-council fresh & arc-native (don't reuse the global council)

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** duplicated council logic across arc-native files and the global `~/.claude` council starts drifting and the double-maintenance cost outweighs arc-native ownership.

## Context
A fully-working advisory council already exists globally at `~/.claude` (a `council` skill + 9
`council-*` agents). arc-council could depend on it, or ship its own arc-native files. arc distributes
via `sync-to-project`, so a dependency on a user's global install would not travel with the toolkit.

## Options considered
1. **Reuse the global council** — pros: zero new files; cons: not synced into consumer projects, arc can't version or evolve it, breaks if the user's global install changes.
2. **Build fresh arc-native** — pros: ships & versions with arc, self-contained, tunable to arc idioms; cons: ~18 new files, some conceptual overlap with the global one.

## Decision
Build fresh, arc-native files under a `council` namespace. The global council is mined as a **reference
blueprint only** — never imported or depended on. Chosen because a synced toolkit cannot depend on a
per-user global install it doesn't own.

## Consequences
Easier: versioning, distribution, arc-idiom consistency. Harder: two councils now exist on this machine
(global + arc) — mitigated by the additive-only non-negotiable and the revisit trigger above.
