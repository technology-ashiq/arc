# ADR 2024 — The install lifecycle is npm's, and every verb reads the manifest first

**Status:** accepted
**Date:** 2026-10-14
**Product:** `distribute` (engine: `bin/arc.mjs`, `arc-install.mjs`, `install-targets/common.mjs`; DST-O)
**Reversibility:** one-way
**Why one-way:** the manifest schema written into consumer projects is read by every later `arc` CLI; once v2 manifests exist in the wild, the reader must accept them forever
**Revisit trigger:** a consumer project ends up with a managed path that no manifest names, or with a manifest path that no verb would remove (either one means the manifest is no longer the single record).

## Context

Today `arc init --target T --dir D` takes one target, writes `.arc-install.json` =
`{version:1, target, source, files:{path:sha}, degraded, forced}` (`common.mjs:195-199`), and refuses a second target in
the same directory (`arc-install.mjs:93`). `doctor --dir` reports placed / degraded / missing / unmanaged-conflict. No
verb tells a project how far it is behind, moves it forward, or removes it. The owner's ask is the lifecycle a developer
already knows from npm.

## Options considered

1. **A separate manifest per target** (`.arc-install.<target>.json`). Four records to keep consistent, and "what does arc
   own here" needs a union read every time.
2. **One v2 manifest holding every target, read first by every verb** (npm's `package-lock` role).
3. **No manifest: verbs re-derive ownership from the render.** Then `uninstall` after a source change would remove the
   wrong set. Rejected: ownership must be what was written, not what would be written today.

## Decision

Option 2.

- **Manifest v2** (`.arc-install.json`): `{version: 2, targets: [..], tag, commit, files: {path: {sha, target}}, degraded,
  forced, hooks_path_set}`. `tag` is the arc tag the render came from, or `null` from an untagged commit (ADR-2025).
  `hooks_path_set` is `true` only when this `init` set `core.hooksPath` itself. Every reader accepts v1 (one target,
  `source` read as `commit`, `tag: null`, `hooks_path_set: false`), and the first `upgrade` rewrites it as v2.
- **Verbs.** `init [--target T]…` (no `--target` = every verified target, the union under ADR-2023's one-owner-per-path
  rule; `claude-code` included) · `doctor` · `outdated [--all]` · `upgrade [--to <tag>] [--confirm]` · `uninstall`.
  Every verb reads the manifest before it touches the disk. Every write or removal is limited to paths the manifest names
  (or, for `init`/`upgrade`, paths the new render names, recorded before the write).
- **Path safety.** Each manifest path is checked before use: relative, no `..` segment, no drive letter or leading `/`,
  no NUL, and `realpath(dir/path)` inside `realpath(dir)`. A manifest path that fails this is refused **by name**
  (`Refused("manifest-path", <path>)`) and nothing is written or removed. Symlinks are never followed out of the project.
- **`upgrade --to <tag>`** renders from a read-only extract of that tag in a scratch dir: `git read-tree` + `checkout-index`
  through a temporary `GIT_INDEX_FILE`, so the checkout's own index, HEAD and worktree list are untouched (never a checkout
  or `git worktree` in the running CLI's tree, and no `tar`, which on Windows can be GNU tar reading `C:` as a host). A tag
  absent locally exits 6 `tags: not fetched`, 0 writes. A move to an older tag lists the sections it crosses backwards,
  and their BREAKING lines still stop it without `--confirm`.
- **`upgrade`** re-renders, compares each managed path's on-disk sha with the manifest's: an unchanged path is replaced,
  a locally changed one is copied to `.arc-install-backup/<stamp>/<path>` first and listed `backed-up`. A path the new
  render drops is removed only if its bytes still match the manifest. A path that is new in this render and already
  exists unmanaged is `unmanaged-conflict` and refuses without `--force`, as `init` does.
- **`uninstall`** removes every managed path whose bytes match the manifest, keeps a locally changed one (listed `kept
  (modified)`) unless `--force`, removes now-empty directories it created, unsets `core.hooksPath` only when
  `hooks_path_set` is true and the value is still `.githooks`, and removes the manifest last.
- **No `--all` write verb.** `outdated --all` reads. Each `upgrade` is one project, and its result is a change the owner commits.
- The CLI's own version (the checkout `arc` runs from) and a project's rendered version (the manifest) are two different
  numbers. `arc upgrade` moves only the second.

Measured in P09 (attack rounds on `8707a5c` and `0eb78f6`): a commit is accepted into git's argv only as 40 hex (or
`unknown`) and a tag only as `vX.Y.Z`; a managed file that cannot be removed (locked) stays in the record as
`kept (locked)`; an upgrade from an arc checkout with uncommitted changes says so.

## Consequences

- A v1 manifest from Cycle 1 consumers (arc-sandbox) keeps working. `doctor`, `outdated` and `uninstall` read it, and
  `upgrade` converts it.
- `init` without `--target` changes behaviour: it used to be a usage error and now renders all four. That is listed in the CHANGELOG under Changed.
- `.arc-install-backup/` is a new directory in consumer projects. `upgrade` prints its path, and `uninstall` leaves it
  in place (the owner's backups are never removed by a tool).

## Evidence

- `common.mjs:195-199` (v1 schema), `arc-install.mjs:93` (`other-target`), `bin/arc.mjs:115-126` (verbs: init, doctor, compile only). Survey 2026-10-14.
- npm's model: `npm outdated` (read), `npm update` (one project), `npm uninstall` (manifest-driven); `npm update -g` moves the CLI. Stable, well-known behaviour, so no research charter.

**Confidence:** high on the current state; medium on v1→v2 migration edge cases, which are fixtured in P09.
