# ADR 2002 — DST-B: enforcement is three levels, and only merge-time is the truth

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** one-way
**Revisit trigger:** the owner cannot or will not protect `main` with required checks during Phase 01 (assumption A-07). Then every merge-time "truth" cell is downgraded to **advisory** in `engine/enforcement.yaml`, and `doctor --repo` says so on every run.

## Context

Today the three blocking hook events (`PreToolUse`, `PreToolUse-edit`, `PreToolUse-read`; the design source counted two) fire from Claude Code hooks and from nowhere else. There is no git hook, and on 2026-10-07 `gh api repos/technology-ashiq/arc/branches/main/protection` returned `404 Branch not protected`. A second harness would therefore get arc with its rules removed. A git hook is one `--no-verify` from silence. Only the repository's merge path can make a gate final. Cited from ADR-2000.

## Options considered

1. **Emulate hooks per harness** — this is the no-go "hook emulation": one shim per harness, none tested on its harness.
2. **Git hooks as the gate** — any workstation can bypass them.
3. **Three levels with merge-time as the truth** — tool-time is speed, commit-time is the second line, and merge-time (required checks on a protected `main`) cannot be bypassed from a workstation.

## Decision

Option 3. Tool-time (harness hooks) may be advisory. Commit-time calls the **same** fragment scripts and is the second line. Merge-time is the only truth. Every blocking rule has a merge-time row (REQ-01), and the repository is configured to make that row final (REQ-09). The *Enforcement boundary* table lands as `engine/enforcement.yaml` (beside `engine/harnesses.yaml`, ADR-2012), which `gate-parity.mjs` reads. That gate is FAIL-FROM-BIRTH and has `--mutant-selftest`. Nothing is enforced only in a Claude Code hook, and a git hook is never called the gate.

## Consequences

A harness with no hook model is a slower arc, not a weaker one. The local-damage class (destructive shell) has no merge-time truth. It is declared `advisory` for non-Claude harnesses rather than being silently absent. REQ-09 depends on an owner action (repository settings), and ADR-2015 records which settings.
