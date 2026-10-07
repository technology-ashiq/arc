# ADR 2011 — DST-K: a two-surface adversarial pass on every adapter and every gate

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

Cycle 6 ran 7 passes and found 77 real holes. Where two attackers worked on one gate, they shared the root cause and almost none of the findings. An author's own breaking inputs found 0 holes, while an unanchored agent found 9 (`gate-author-cannot-be-its-attacker`). "Validate one read, compare another" has been fixed in four files, and it reappeared each time in a file that had not been checked. Cited from ADR-2000.

## Options considered

1. **One generalist attacker** — its blind spot is structural.
2. **Two fresh agents per adapter and per gate** — one on the plan/compile logic, one on the filesystem and shell boundary.

## Decision

Option 2, run through `/arc-attack` (ADR-0226) on the local commit before the single push. Each agent carries `initiatives/distribute/fixed-defects.md`, with the instruction to check every listed class in *every other adapter and gate*. Neither agent is the author. REQ-10 turns the expected boundary findings (paths with spaces, drive letters, symlinks, a target directory that is a file) into acceptance fixtures, so the pass confirms them rather than discovering them. There are at most two attack rounds per PR; LOW leftovers go to `initiatives/distribute/debt-ledger.md`.

## Consequences

With 4 adapters and 3 gates, the passes are budgeted inside each phase's appetite, not on top of it.
