# ADR 0105 — `develop` ships as its own product and rides `--for develop` with no resolver edit

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a second surface needs `develop`-specific resolution behaviour that the generic
`--for <surface>` path cannot express, which would mean the resolver has to learn about develop after all.

## Context

`/arc-develop` is a lane surface under `.claude/rules/lanes.md`. The obvious assumption is that adding
a surface means teaching `lane-resolve` about it — and `lane-resolve.sh` / `lane-resolve.mjs` are
byte-identical twins that every arc command depends on, so any drift between them blocks the whole
tool. That is the highest-blast-radius file pair in the repo.

Reading the resolver settles it: `--for <surface>` is a free-form string. Only `kickoff` is
special-cased, and only to return `status=create`. Every other surface value flows through the
standard resolution path and already gets the full contract — explicit flag validated, root-mode when
no `initiatives/` exists, auto-resolve on exactly one eligible lane, ask otherwise, exit 4 with
"Lanes are created by /arc-kickoff only" on an unknown lane.

The second question is packaging: arc ships as products with manifests (`products/*/manifest.json`,
`requires` edges, validated by `product-lint.mjs`).

## Options considered

1. **Own product, generic surface** — `products/develop/manifest.json` requiring `core` and `hq`;
   `/arc-develop` passes `--for develop` and `develop-lint.mjs` imports `resolveLane` from
   `.claude/scripts/core/lane-resolve.mjs`, exactly as `kickoff-lint.mjs` does. No resolver change.
2. **Own product, resolver taught about `develop`** — add the surface to an allowlist for stricter
   validation. Buys a clearer error on a typo'd surface name; costs an edit to both twins, a
   `tree-manifest.txt` regeneration, and re-running the full 19-job matrix on the repo's hottest file.
3. **Fold the command into the `plan` product** — fewer manifests, but the design source is explicit
   that `develop` is a separate product that *composes with* `plan`, and merging them would make the
   execution harness a dependency of the planner it is supposed to be independent of.

## Decision

Option 1. The one reason that carried the most weight: the lane contract is already fully available
through the generic path, so the strictest version of "don't touch the hot twins" costs nothing.

`develop-lint.mjs` never re-implements resolution; it imports `resolveLane`, anchors on the git
toplevel, and prints the lane echo first, per `.claude/rules/lanes.md`.

## Consequences

Easier: Phase 0 ships without editing `lane-resolve.*`, without regenerating the sync-golden manifest
for the resolver, and without putting the whole command surface at risk. `develop` can be installed or
omitted independently, and venture repos get root-mode by construction.

Harder: a mistyped `--for develp` resolves silently as an unknown-but-valid surface rather than
erroring. That is acceptable because the value is only used for messaging and the `kickoff` branch —
but it means the surface string must be passed from one place in the command, not repeated.

What we would revisit if this goes wrong: if surface typos cause real confusion, option 2 becomes a
one-line allowlist addition to both twins with a fixture — a change we can make later at leisure,
which is exactly why this door is two-way.
