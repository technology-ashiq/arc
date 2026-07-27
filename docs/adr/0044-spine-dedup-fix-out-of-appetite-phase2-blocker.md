# ADR 0044 — spine dedup fix stays outside this appetite; hard dependency gate before Phase 2 close

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** the fix has not landed when Phase 2 opens → Phase 2 re-scopes to single-round critique (no re-emit path) and the gate moves to Phase-2 close.

## Context

Owner fork at kickoff. Cycle-2 close found the spine silently dropping repeat-action
receipts (idem preimage carries no time / per-session identity — `arc-event.mjs:99`;
100+ real receipts lost). Phase 0's DoD says "a reliable receipt on the spine";
Phase 2's critique revision loop re-emits `review.completed` for the same route.

## Options considered

1. **Separate /arc-change fix, blocker before Phase 2 close** — the bug is pre-existing arc-core debt, not design work; Phase 0's single-emission receipt never hits the repeat path. Con: a dependency on work outside this cycle's appetite.
2. **Fix first, in-appetite** — literal "reliable receipt". Con: eats the 5-day design budget on arc-core debt.

## Decision

Option 1 (owner's call, recommended default). The fix is tracked as its own /arc-change
into arc-core; Phase 2 cannot close while design re-emissions are being silently dropped.

## Consequences

Easier: the design appetite buys design. Harder: Phase 2 carries an external dependency
gate — mirrored in the assumptions ledger with its trigger.
