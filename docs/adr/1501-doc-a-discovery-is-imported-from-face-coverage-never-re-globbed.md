# ADR 1501 — DOC-A: discovery is imported from `face-coverage.mjs`, never re-globbed

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** one-way
**Revisit trigger:** the face lane moves, renames or narrows an export `wiki-build` depends on (A-06), or `face-coverage.mjs` stops being the single place the tree is read → the import contract is re-cut here, never by adding a walker to `.claude/scripts/docs/`.

## Context

Locked in the design source (DOC-A). `face-coverage.mjs` already reads every inventory arc has,
FAIL-FROM-BIRTH, with a mutant control. A second walker in the wiki would be the "validate one
read, compare another" defect this repo has fixed in `verdict.mjs`, `lineage.mjs`, `arc-run.mjs`
and at the face door (`reads.mjs`) — a fifth recurrence, in a new lane, after the rule was written.

**Kickoff verification falsified one premise of the design source.** It lists `dirNames`,
`mdStems`, `yamlStems` and `treeKinds` among the exports. They are **module-private**
(`face-coverage.mjs:47–68`, no `export`). So are `treeProducts` (line 846) and `gather` (line 883),
which is the one function that assembles lanes · commands · agents · products · rules · processes
into a single object. The exported readers today are `treeGates`, `treeJobs`, `treeVentures`,
`treeAdrBands`, `treePlans`, `treeCapabilities`, `treeHooks`, `treeLints`, `treeCi`,
`treePlannedRooms`, `treeModules`, `treeOps`.

## Options considered

1. **Import only what is exported, glob the rest** — breaks DOC-A on its first day for six of the eight entity types the wiki needs.
2. **Export the private helpers individually** — the wiki then re-assembles the world itself, and a reader added to `gather` later is invisible to it (the untested-seam defect, `b0f3a4ef`).
3. **Export a `treeWorld(repo)` that is `gather` minus the face contract, and make `gather` = `{ ...treeWorld, contract }`** — one assembly, two consumers; a reader added for the face appears in the wiki with no wiki change.

## Decision

Option 3, plus exporting `dirNames` / `mdStems` / `yamlStems` / `treeKinds` / `treeProducts` for the
fixture tests. The change to `face-coverage.mjs` is **additive and behaviour-preserving**: no reader
changes, no flag changes, `face-coverage --selftest` and `tests/face-coverage.bats` stay green
unmodified. `treeWorld` must not call `loadContract`, so the wiki does not depend on the face's
contract file existing.

`tests/docs-extract.bats` asserts the import two ways: (a) a static scan of every file under
`.claude/scripts/docs/` finds no `readdirSync` / `opendirSync` / `globSync` / `fs.glob` call and no
directory-walking import (`fs/promises` `readdir`, `opendir`); (b) a **mutant** that adds one
`readdirSync` to a scratch copy of `wiki-build.mjs` is asserted to turn the scan RED. Reading a
single named *file* (a manifest, a PROGRESS header) is allowed; enumerating a *directory* is not.

## Consequences

- The face lane is LIVE (Cycle 16, Phase 06) and edits `face-coverage.mjs` (last touched in PR #252).
  The export change is announced to the face session by a paste-ready note before it lands and is
  rebased onto whatever face has merged, per `lanes.md` § shared files.
- The wiki and the face room list can never disagree about what exists.
- If the wiki needs an entity type `gather` does not read, it is added to `face-coverage.mjs` —
  which also makes the face gate cover it.
