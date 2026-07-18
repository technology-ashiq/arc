# ADR 0018 — Phase 3 re-homing is incremental per product, council first

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** two-way
**Revisit trigger:** after the first two product moves, if the byte-diff gate has caught zero
issues AND per-move overhead dominates (ceremony > work), the remaining three may merge into
one move — recorded as a phase-spec amendment via /arc-change.

## Context

Phase 3 physically re-homes every script into `.claude/scripts/<product>/` and every test into
`products/<name>/tests/` — the highest-risk phase: it rewrites hardcoded paths across command
frontmatter allowed-tools, council-lint.mjs pinned agent paths (lines 356/384), bats greps, and
hook wiring, on the owner's daily-driver system.

## Options considered

1. **Big-bang**: all 5 products moved in one commit — pros: one path-update sweep; cons: a red
   byte-diff gate means bisecting a giant diff; rollback is all-or-nothing.
2. **Incremental**: one product at a time — git mv → path updates → full bats + byte-diff gate
   green → commit → next product; order council → core → plan → review → qa — pros: 5
   independent checkpoints, each rollbackable; the cleanest product (council, zero coupling)
   proves the procedure before the riskiest (core, everything depends on it); cons: 5× gate
   ceremony.

## Decision

Option 2 — incremental, council first. The plan's own risk-ordering philosophy applied one
level down: retire procedure risk on the cheapest product before touching the spine.

## Consequences

Easier: diagnosing a red gate (diff = one product); stopping mid-phase with partial value
banked. Harder: 5 gate runs instead of 1 (accepted — the gate is scripted). Phase-03-spec
carries 5 exit checkpoints, one per product move.

## Correction (2026-07-18, /arc-change)

The Context above lists "council-lint.mjs pinned agent paths (lines 356/384)" among the paths
Phase 3 rewrites. That is **wrong** and was inherited by `phases/phase-03-spec.md` and `PLAN.md`
(both now corrected). Those two constants pin `.claude/commands/arc-council.md` and
`.claude/agents/<name>.md` — runtime payload that does NOT move in Phase 3 (assumptions ledger
row 1: Claude Code loads commands/agents only from fixed `.claude/` paths). Editing them would
break a passing gate and would additionally fail the byte-diff gate as a same-file edit during a
move. The decision (incremental, council first) is unaffected.

The real ungated surface found by the ckpt-1 adversarial pass is the `/arc-council` command
**body** — 6 script invocations that `council-lint.mjs:357-364` never parses, because it validates
YAML frontmatter keys only.
