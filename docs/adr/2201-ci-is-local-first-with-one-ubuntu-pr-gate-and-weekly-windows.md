# ADR 2201 — CI is local-first with one ubuntu PR gate; Windows and docker run weekly

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** a Windows-only break reaches `main` twice in one cycle despite the pre-push hook and the weekly `windows-latest` run.

## Context

Locked letters CI-A, CI-B, CI-C, CI-I, CI-K and CI-O (`PLAN-ci.md` §2). arc runs on one Windows PC. ADR-0007's three-OS parity argument (and its macOS amendment) fits a public tool, not a private HQ. The 2026-09-23 "tests never run locally" ruling was made because local bats runs took hours.

## Options considered

1. **Keep three OSes per push.** This gives parity, at ~1,000 billed minutes per push.
2. **The box first, then one ubuntu gate, then Windows + docker weekly.** Windows is covered on every push by the box itself.

## Decision

Option 2. The box is the first gate: `.githooks/pre-push`, which already exists (ADR-2013), is **extended** with lint + `test:changed`. The PR gate is ubuntu Node 24 with jobs `changes`, `quality`, `test`, `security`, plus `face` and `ci-tier` when touched. macOS is dropped (the bash-3.2 audit stays as a lint). Every workflow has concurrency with cancel-in-progress, skips drafts, sets `timeout-minutes` and `permissions: contents: read`, pins actions by SHA, and filters paths at job level only. `weekly.yml` runs the `windows-latest` `node:test` suite, the clean-install proof and `ci-tier`.

## Consequences

This supersedes ADR-0007 and its macOS amendment, and amends ADR-0006's schedule (the tier split is unchanged). `.claude/rules/testing.md` "Where tests run" and `AGENTS.md:12, 68-76` are rewritten in Phase 01.
