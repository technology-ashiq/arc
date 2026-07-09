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

## [0.2.0] — unreleased

Baseline for the arc v2 "world-best" upgrade. See `PLAN.md` for the initiative and
`phases/` for per-phase specs. 0.1.x = the pre-initiative arc template.
