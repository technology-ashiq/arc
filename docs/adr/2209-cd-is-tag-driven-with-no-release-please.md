# ADR 2209 — CD is tag-driven, with no release-please

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** a release ships whose `CHANGELOG.md` section does not match its tag.

## Context

Locked letter CI-L. arc already versions itself with `VERSION`, `CHANGELOG.md` and the version-gate (ADR-2025: versions are git tags).

## Options considered

1. **release-please.** A second versioning system that would fight the first.
2. **A `v*` tag push** that calls `weekly.yml`, then `npm pack`, then a GitHub Release with the tarball and the matching `CHANGELOG.md` section.

## Decision

Option 2.

## Consequences

The workflow is `release.yml`, added in Phase 01 alongside face's expected-set change.
