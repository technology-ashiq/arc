# Changelog

All notable changes to **arc** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 00 — steel thread.** `arc-scan` pipeline: diff-scope → semgrep + gitleaks
  adapters → minimal-SARIF normalize/merge → threshold triage stub → review-ledger
  stamp. Every tool degrades to `SKIPPED` (never silent) when missing.
- `bats-core` self-test suite for the `arc-scan` spine.
- GitHub Actions CI running the bats suite on `ubuntu-latest` and `windows-latest`
  (Git Bash), plus a `VERSION`/`CHANGELOG` gate.
- `scan` review-kind added to `review-ledger.sh`.

## [0.2.0] — unreleased

Baseline for the arc v2 "world-best" upgrade. See `PLAN.md` for the initiative and
`phases/` for per-phase specs. 0.1.x = the pre-initiative arc template.
