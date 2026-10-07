# ADR 2003 — DST-C: the capability matrix is declared, machine-readable, and the install obeys it

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

`.codex/hooks.json` was written from a machine, not from a spec, and carries that machine's drive letter. A gap that is declared is Truth Law (E3). A silent `.codex/` is not. ECC's `lib/harness-capabilities.js` was judged the highest-fit pattern in the 2026-08-12 study. Cited from ADR-2000.

## Options considered

1. **Per-adapter knowledge in code** — each adapter "knows" what it can place. Nothing is reviewable, and `doctor` cannot say what *should* be there.
2. **One declared matrix, dated per row** — reviewable, testable, and read by install and doctor alike.

## Decision

Option 2. `engine/harnesses.yaml` (beside `engine/router.yaml`, ADR-2012) has one row per target and one column per feature: commands · agents · hooks · skills · mcp · brain-file · subagents · **user-only invocation** · **argument substitution**. Each cell is `true | false | partial:<note>`, and each row carries a `verified: <date>`. The install places only `true` cells and prints every `false` by name. A row without a date does not install. Every harness beyond the four v1 targets is a row with `status: unverified` and a date, never a row that installs.

## Consequences

Phase 00 verifies the four v1 rows against live docs through `/arc-capability`, not from memory. A minor upstream release can break a row. The fix is then a pinned version in the row and a mismatch line from `doctor` (A-03).
