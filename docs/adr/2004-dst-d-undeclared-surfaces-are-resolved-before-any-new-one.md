# ADR 2004 — DST-D: undeclared surfaces are resolved in Phase 00, before any new one is born

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** a consumer outside this repo turns out to read `.codex/` or `.agents/skills/` (A-06). The deletion is then reverted from git history for that consumer, and the `codex` golden is built around the existing files.

## Context

`.codex/` reads as "arc supports Codex". It is actually a never-installed copy with a machine-specific `hooks.json`. `.agents/skills/source-command-arc-*` reads as "arc's commands are skills", yet nothing generates, checks or installs those files. Adding `.opencode/` beside two undeclared directories would be a third lie. Constitution E3. Cited from ADR-2000.

## Options considered

1. **Leave them until Phase 03 renders replacements** — the lie persists through the gates phase.
2. **Resolve them in Phase 00: output or deleted, no third state.**

## Decision

Option 2. Phase 00 runs before any renderer exists, and the gates phase precedes every adapter. So in Phase 00 `.codex/` is **deleted** (it is recoverable from git history) and is re-born in Phase 03 as a rendered output of the `codex` target. Each `.agents/skills/source-command-arc-*` file is compared against the command it names. If the conversion is faithful, the file moves out of `.agents/skills/` into `tests/fixtures/distribute/goldens/codex-seed/`, as the evidence and first reference for the `codex` adapter. If not, it is deleted. `seo-article-writer` is the growth lane's, and it moves to `.claude/skills/`.

## Consequences

Between Phase 00 and Phase 03 arc offers Codex nothing. Before Phase 00 it offered something false. The comparison verdict for each file is recorded in the Phase 00 evidence.
