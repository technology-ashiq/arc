# ADR 2017 — every frontmatter key has a declared fate per target

**Status:** accepted
**Date:** 2026-10-09
**Product:** `distribute`
**Reversibility:** two-way (a fate is one cell of `engine/frontmatter-keys.yaml`, reviewed as a diff)
**Revisit trigger:** Phase 03's stop rule fires (more than 5 of the 29 commands render `[unsupported]` on `opencode`), or a harness release adds a field one of these keys could render to (an OpenCode argument hint, a Codex per-skill tool allowlist).

## Context

ADR-2001 makes the Claude dialect the source and renders every other harness from it. A construct a target cannot hold is dropped only where the capability matrix says so, and otherwise fails by name. Both rules need a list of every key the source may carry and what each target does with it. Without that list, a new key would be dropped by ignorance, and pre-mortem #5 of the design source would come true: an `allowed-tools` line dropped on OpenCode without a word, so a command that was fenced in Claude Code runs unfenced elsewhere.

The census on 2026-10-09 found that 29 commands use 5 keys (`description` 29, `allowed-tools` 26, `argument-hint` 22, `name` 1, plus the new `targets`) and 32 agents use 4 (`name` 32, `description` 32, `tools` 32, `model` 31). No file has a continuation line, a comment or a repeated key.

Two keys had no matrix cell that could carry a drop. OpenCode holds `$ARGUMENTS` (`argument_substitution: "true"`), but no OpenCode command field carries a hint: the commands page lists `description`, `agent`, `model` and `subtask`, read 2026-10-09. And no harness but Claude Code resolves the tier alias `sonnet`. Without a cell, both would have to be `[unsupported]`, which fails 22 commands and 31 agents for a label and a model name.

## Options considered

1. **`[unsupported]` for both.** Truthful, but it trips Phase 03's stop rule on a hint string, and it would make every agent unrenderable on every non-Claude target.
2. **Fold them into an existing cell** (`argument_substitution`, `agents`). The cell would then say something it was never verified for. `argument_substitution` is true on OpenCode, and that is correct.
3. **Declare two new cells** in `engine/harnesses.yaml`, `argument_hint` and `model_tier`. Each is read against the docs and dated in the file's header, and drops stand on them. The matrix grows from 9 cells per row to 11, and REQ-02's `degraded:` lines name both.

## Decision

Option 3. The fate table is `engine/frontmatter-keys.yaml`: one fate per key per verified row, in four forms.

- `render:FIELD` writes the value to FIELD.
- `drop:CELL` is legal only where that row's CELL is `false` or `partial:`.
- `consume` marks a compiler directive that no target file carries (`targets` off the claude-code row).
- `unsupported` fails the file by name.

The claude-code fate is always `render:` the key itself, because that target is the source.

The decisions that are not mechanical:

- **Tool fences render; they are not dropped.** On OpenCode, a command's `allowed-tools` renders to the `permission` of a companion agent the command names in `agent:`, and an agent's `tools` renders to its own `permission`. On skills-only both render to the agentskills `allowed-tools` field. Only Codex drops them, under its `partial` `commands` and `agents` cells (it has no per-skill or per-agent allowlist), and `doctor` names the loss.
- **`argument-hint` drops everywhere but Claude Code** (`argument_hint: "false"`). **`model` drops everywhere but Claude Code** (`model_tier: "false"`). The target runs its own configured model, and ADR-2006 keeps the model seat out of scope.
- **`targets:`** is a comma-separated list of verified row ids. It must include `claude-code`. When absent it means every verified row. It goes on the three Claude-only commands, `arc-face-module` (named in the design source), `arc-freeze` and `arc-unfreeze`. The last two set a boundary that only a Claude Code PreToolUse fragment enforces, so on any other harness they would announce a fence that nothing holds.

`frontmatter-lint.mjs` enforces the table in two checks. First it checks the table against the matrix: every verified row has a fate, claude-code is the identity, and no drop stands on a true cell. Then it checks the tree against the table: every line is `key: value`, there are no unknown or repeated keys, no empty values, and every entry in `targets:` names a verified row. It is also the one frontmatter parser and walker that `arc-compile --input commands|agents` imports (ADR-2012).

## Consequences

A new frontmatter key cannot land without a row in the table, so it cannot be dropped by ignorance. Adding one is a reviewed diff that names a fate for every target. The matrix carries two more cells per row, so `tests/distribute-birth.bats` counts 11. Codex installs from P03 run arc's commands without a tool fence, and that is declared, not hidden. The companion-agent render on OpenCode is a P03 adapter job, and its golden is what proves it.
