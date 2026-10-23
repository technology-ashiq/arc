# ADR 2208 — The `security` job, Dependabot, and one full-history gitleaks scan

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** `npm audit --audit-level=high` blocks a PR on an advisory with no fix available for 7 days.

## Context

Locked letter CI-J. The repo has been public, so a secret committed at any point in history may already have been read.

## Options considered

1. **PR-range scans only.** They miss anything already exposed.
2. **PR-range scans plus one full-history scan now.**

## Decision

Option 2. The `security` job runs gitleaks on the PR range, opengrep pinned at v1.26.0, and `npm audit --audit-level=high` for the root and `face/`. Dependabot covers npm (root, `face/`) and `github-actions`, weekly. The owner runs one `gitleaks git --log-opts="--all"` scan before Phase 00, and any real secret it finds is rotated.

## Consequences

The session reports only a count of findings, never a value (`AGENTS.md`: never print secrets).
