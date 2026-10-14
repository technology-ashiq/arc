# Changelog

All notable changes to **arc** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 01 — credibility & hygiene.** Strictness profiles (`starter`/`standard`/
  `strict`) via `arc-profile.sh`: one `arc.profile` settings key switches coverage,
  docs, and scan gates as a set, with per-gate overrides. `/arc-review` now auto-stamps
  the `code` ledger kind on a ship verdict. Cross-platform `sync-to-project.sh` (bash
  twin of the `.ps1`). bats suites for profiles (11) and sync (6).
- **Phase 00 — steel thread.** `arc-scan` pipeline: diff-scope → semgrep + gitleaks
  adapters → minimal-SARIF normalize/merge → threshold triage stub → review-ledger
  stamp. Every tool degrades to `SKIPPED` (never silent) when missing.
- `bats-core` self-test suite for the `arc-scan` spine.
- GitHub Actions CI running the bats suite on `ubuntu-latest` and `windows-latest`
  (Git Bash), plus a `VERSION`/`CHANGELOG` gate.
- `scan` review-kind added to `review-ledger.sh`.

### Changed
- **Block-by-default (ADR-0008).** Gates now enforce out of the box under the
  `standard` profile (was `warn` for coverage + docs). `starter` restores warn-all.
- Repo hygiene: removed committed hook write-probes (`.writetest*`, `*.wt`, now
  gitignored); agent-browser marked SHIPPED; Playwright MCP note resolved to
  keep-as-fallback.

## [0.2.0] - 2026-10-14

### Added
- **Zero-step access (distribute Cycle 3, ADR-2023).** `arc compile --self` renders `.codex/`, `.opencode/` and
  `.agents/skills/` into arc itself as committed outputs; a fresh clone opened in OpenCode lists and runs the arc
  commands with no install step. CI fails on a stale render (`distribute-self-render.bats`).
- **The lifecycle (ADR-2024, ADR-2025).** `arc outdated` (tag@commit both sides, commits behind, the CHANGELOG range)
  and `arc upgrade [--to vX.Y.Z] [--confirm] [--force]` (re-render, back up local edits, refuse a BREAKING range).
  Install records are version 2 (`targets`, `tag`, `commit`, per-file target); version 1 records are still read.
- `version-lint.mjs`, called by the existing version gate.

### Changed
- An OpenCode session runs as its command's fence (`mode: all`), so the top-level session is fenced too; a missing
  or stale fence refuses the run `NO-FENCE` (ADR-2027).
- `arc-ship` deploys only to a target git tracks, and its fence grants `vercel --prod` alone.
- The wrapper records each run's process tree and reaps an orphaned one before the next run spends; a survivor ends
  the run `KILL-INCOMPLETE`.

### Fixed
- The spine redactor quarantined any `ship.done` whose URL was a bare host (`https://x.vercel.app`): the URL ran into
  the next JSON field and read as a password.


Baseline for the arc v2 "world-best" upgrade. See `PLAN.md` for the initiative and
`phases/` for per-phase specs. 0.1.x = the pre-initiative arc template.
