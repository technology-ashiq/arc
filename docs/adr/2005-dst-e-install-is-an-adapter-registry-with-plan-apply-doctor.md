# ADR 2005 — DST-E: install is an adapter registry with plan → apply → doctor, an install manifest, and goldens per target

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

`sync-to-project.sh` once overwrote a consumer's `settings.json`, and `arc-settings-merge.mjs` exists because of that defect. An installer that writes into somebody else's directory has to know which paths it owns. ECC's `arc-registry.json` pattern was judged better than ECC's own install. LexOS and every root-mode consumer depend on today's sync output, which is a permanent consumer contract (ADR-0054). Cited from ADR-2000.

## Options considered

1. **Extend `sync-to-project.sh` per harness** — bash per target, no plan, no manifest.
2. **An adapter registry** — `plan` is pure, `apply` is manifest-recorded, and `doctor` reads the result back.

## Decision

Option 2. `.claude/scripts/engine/install-targets/<harness>.mjs` (ADR-2012) exports `{ plan(tree, dir) → ops[], apply(ops), doctor(dir) }`:

- **`plan`** is pure and printable. `--dry-run` prints it and writes nothing.
- **`apply`** writes only what `plan` returned, through temp-and-rename with manifest-driven rollback (REQ-10), and records every owned path in `<dir>/.arc-install.json`. It **refuses an unmanaged file at a managed path by default**. `--force` overwrites, and the manifest says so.
- **`doctor`** reads the manifest first and the directory second.

Every rendered target has a golden tree under `tests/fixtures/distribute/goldens/<target>/`. The `claude-code` golden is today's `sync-to-project.sh` output, captured in Phase 00 before any code moves. The re-pointed script must be byte-identical against it. The `settings.json` merge belongs to the adapter.

## Consequences

LexOS sees zero behavioural change. Every boundary case (a file where a directory belongs, a symlink, a path with spaces, a Windows drive letter) is named in the fixtures and runs on all three CI legs.
