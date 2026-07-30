# ADR 0057 — PORT-H: ownership boundary lint — WARN-first, derived from manifests

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

With several lanes in one repo, a lane's diff could silently touch another product's
files. arc already has an ownership map: `products/<name>/manifest.json`. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §5 PORT-H.

## Options considered

- New ownership registry per lane — rejected: a second registry duplicates the manifest
  and drifts.
- Derive ownership from the EXISTING manifests — accepted.

## Decision

A lane's diff may touch: its own `initiatives/<lane>/**`, its module's manifest-listed
files, `tests/<lane>-*`, and shared docs only via `/arc-change` routing. The lint derives
ownership from `products/*/manifest.json` — no new registry. WARN-first per trial-ledger
discipline; every WARN prints `Expected:` / `Found:` / `Example:` (lint-UX rule, PLAN
non-negotiables). Promotion to BLOCK only via trial-ledger evidence.

## Consequences

- Cross-lane edits become visible at review time instead of discovered at merge time.
- The lint inherits manifest quality: files missing from a manifest surface as ownership
  noise — which is itself useful drift detection (sync.bats already pins
  manifests-vs-reality).
