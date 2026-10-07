# ADR 2001 — DST-A: the Claude dialect is the source; every other harness directory is rendered from it

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** one-way
**Revisit trigger:** arc stops being Claude-first by owner ruling. A neutral source format of arc's own (the spec-kit / rulesync shape) is then the v2 that follows. Also: Phase 03's stop rule fires (more than 5 of the 29 commands render `[unsupported]` on `opencode`).

## Context

v1.1 of the design source made SKILL.md the source. A scan of five tools that ship one workflow to many harnesses (GSD, compound-engineering-plugin, spec-kit, rulesync, ECC) found that none uses SKILL.md as its source. Two keep the Claude dialect canonical and convert downward. Two render from a neutral format of their own. All five treat skills as an *output*. Making skills the source would have changed every command from user-typed to model-triggered, with no portability gain. Owner ruling via the design source v1.2, cited from ADR-2000.

## Options considered

1. **SKILL.md as source** — one open standard. But it changes the invocation model of 29 commands, and no peer tool does it.
2. **A neutral arc format** — Claude stops being privileged. But it needs a converter *into* Claude as well as out of it, and it means a 58-file migration.
3. **Claude dialect canonical, render down** — nothing migrates, and `arc-compile` already has adapters, a named `[unsupported]` and goldens (ADR-0201/0202).

## Decision

Option 3. `.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/` and `.mcp.json` are the source and are **not moved, renamed or reformatted**. `.codex/`, `.opencode/` and the `skills-only` bundle are rendered outputs of `arc-compile`, each with do-not-edit banners and dirty-diff CI. Three rules apply:

1. A per-file frontmatter key `targets:` (default: every verified row) limits where a command renders.
2. A construct a target cannot express is dropped **only where the matrix cell says so**. Otherwise it fails by name with `[unsupported]`.
3. **No prose fallback, ever.**

Skills are an output format, never the source.

## Consequences

The Claude Code target is the identity: `/arc-kickoff` stays the same file it was. A Claude-only construct cannot be flattened silently. Phase 02's lint fails an unknown frontmatter key, so nothing is dropped by ignorance. Harder: every frontmatter key now needs a declared per-target fate (the Phase 02 ADR).
