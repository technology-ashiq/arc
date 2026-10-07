# ADR 2007 — DST-G: `AGENTS.md` is the brain; `CLAUDE.md` is `@AGENTS.md` plus marked Claude-only blocks

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

`AGENTS.md` is read by Codex, OpenCode and most skill-reading harnesses. Today it is a 118-line template that still says `Name: TODO`. `CLAUDE.md` carries the real rules but still holds template `TODO` lines, so the owner has been loading a template as the brain for three months. Rules that only one harness can read are rules the other harnesses break. Cited from ADR-2000.

## Options considered

1. **Duplicate the rules into both files** — they will drift, as the two MCP configs already have.
2. **One brain, one import** — `AGENTS.md` carries every harness-neutral rule, and `CLAUDE.md` imports it and keeps only what is Claude-specific.

## Decision

Option 2. The harness-neutral rules move to `AGENTS.md`: branch discipline, publish-is-irreversible, change discipline, tests-on-CI-only, and the shell-quoting law. `CLAUDE.md` becomes `@AGENTS.md` plus blocks each marked `<!-- claude-only -->` (hook names, the `code-reviewer` subagent, output styles). `brain-drift.mjs` FAILs on any rule heading in `CLAUDE.md` that is absent from `AGENTS.md` unless it is marked claude-only (REQ-06). Every `TODO` leaves both files in Phase 01.

## Consequences

`CLAUDE.md` is a shared file that every lane's session loads, and `sync-to-project.sh` copies a template of it to consumers. The rewrite lands in one Phase 01 PR, with the sync golden regenerated in the same commit if the synced template changes.
