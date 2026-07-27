# ADR 0034 — DES-B: verification is read-only, enforced mechanically; creation fixes, critic re-verifies

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** the fix round-trip (critic reports → creation fixes → critic re-verifies) proves too slow across two consecutive phases' retros.

## Context

The current `design-reviewer` (products/qa) fixes its own findings — the verifier
approves its own work, which arc doctrine (anchored creation · unanchored verification ·
deterministic gates) forbids. Superseded-record row 6 of the frozen plan killed
self-fixing. Enforcement must be mechanical, not prose.

## Options considered

1. **Read-only critic, mechanical enforcement** — agent frontmatter `tools:` without Edit; `.claude/hooks/PreToolUse-edit.d/` fragment (existing freeze-hook pattern) allowing critic writes ONLY under `docs/design/critique/**`; receipts via scoped `Bash(bash .claude/scripts/hq/arc-event.sh:*)` (the /arc-qa allowed-tools pattern). Con: fix loop needs a round-trip.
2. **Prose instruction "don't edit"** — cheap. Con: unenforced; agents drift.
3. **Keep self-fixing reviewer** — fast. Con: no verification exists by construction.

## Decision

Option 1 — all three mechanisms, all existing arc machinery, no new infra. Fix flow:
critic reports → creation side fixes (composer during explore; build mode during
implementation) → critic re-verifies. The verifier approving its own edits is impossible
by construction.

## Consequences

Easier: critique output is trustworthy; findings receipts are honest. Harder: every fix
costs a re-verify round (bounded: ≤2 rounds, then human call — REQ-08).
**design-critic is a NEW agent** — never a repurposed design-reviewer with permissions
stripped; the old agent keeps running in parallel until retirement (ADR-0042).
