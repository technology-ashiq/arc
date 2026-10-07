# ADR 2010 — DST-J: v1 targets are `claude-code` · `codex` · `opencode`, plus one generic `skills-only`

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** a real person asks for a full row for Hermes, Kimi CLI, Gemini CLI or Cursor, or the owner runs one for a week. That row is then a v2 trigger.

## Context

Verifying nine harnesses is a week of reading changelogs for tools nobody here runs. Four rows verified against live docs take a day. `opencode` alone makes the owner's model list true at once, because it runs Ollama, DeepSeek, Kimi, GLM and any OpenRouter model under one harness. Cited from ADR-2000.

## Options considered

1. **All nine harnesses** — the rabbit hole the design source names.
2. **Four targets, the rest declared `unverified` with a date.**

## Decision

Option 2:

- **`claude-code`** is the identity target (ADR-2001).
- **`opencode`** renders commands as `.opencode/command/*.md` and agents as `.opencode/agent/*.md`. These paths are confirmed or corrected against live docs in Phase 00.
- **`codex`** renders commands **as skills** (`$arc-<name>`), and already has a compile adapter and a driver.
- **`skills-only`** (AGENTS.md + skills + MCP) is what Hermes Agent, Kimi CLI and Gemini CLI get in v1.

Every other harness is a dated `status: unverified` row.

## Consequences

Both `opencode` 1.17.18 and `codex-cli` 0.147.0 are installed on the build machine (read 2026-10-07). The Phase 00 rows cite those versions.
