# ADR 1302 — FACE-C: `/api/decide` is the one write, and it IS the `arc-inbox` function

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** constitutional amendment to E2 only (7-day cooling, machines never
amend). No product-level trigger exists on purpose.

## Context

Human sovereignty is structural (E2): the only write outside the factory is
`arc-inbox approve|reject <ULID> --reason`. A UI multiplies temptation — every "just this
one button" is a new write path (pre-mortem row 3).

## Options considered

1. **`/api/decide` calls the same function `arc-inbox` calls; byte-parity fixture** —
   pros: one implementation, CLI refusal codes surface verbatim, spine cannot tell the
   door. Cons: `arc-inbox` must expose an importable function.
2. **L2 shells out to the `arc-inbox` CLI** — pros: zero refactor. Cons: string-glued
   argv on Windows, exit-code parsing, the CLAUDE.md shell-quoting law makes reason text
   in argv a standing hazard.
3. **Re-implement approve/reject in L2** — cons: a second truth for the most protected
   write in the company. Rejected on sight.

## Decision

Option 1 (falling back to option 2 only if the refactor is refused — assumptions row 2
STOPs L3 instead). `/api/decide` = the `arc-inbox` function; **reason mandatory** (≤2000
bytes, as the CLI enforces); a fixture proves the emitted `decision.recorded` is
**byte-identical** to the CLI's (minus id/ts); a **route-enumeration fixture** proves no
other mutating route exists. No bulk stamp, no default reason, no undo. Stamps exist ONLY
for `approval.requested` — `arc-inbox` refuses every other ULID (`WRONG_KIND`); other
needs-you kinds render as cards with chips, never stamps. Every other action a UI might
offer is a **command chip** (copy, never execute) or a **seal** (forever-human, quoting
the article/ADR).

## Consequences

Easier: E2 stays checkable by fixture rather than by review; REQ-10's journal↔receipt
match works because parity makes the spine blind to the door *by design*. Harder: the
`arc-inbox` function-export refactor is on this lane's critical path (Phase 03, block B
kill: parity not green by day 4 → L3 does not start).
