# ADR 1722 — A venture repo is a private GitHub repo under the owner's account, named after the slug

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

The arc repo is public; venture code and any PII must never land in it.

## Options considered

1. **Venture code under arc** — one repo / public, mixes ventures.
2. **`<owner>/<slug>` private repo, created by the `repo` adapter, deletable by teardown**.

## Decision

Option 2. `arc-sandbox`'s repo is `technology-ashiq/arc-sandbox`, private. The `repo` adapter's `delete` is a `sensitive_action`.

## Consequences

Runner state stays in arc's instance-only `.claude/state/launch/`; venture source stays in the venture repo.
