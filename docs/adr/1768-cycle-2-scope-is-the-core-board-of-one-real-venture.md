# ADR 1768 — Cycle 2's scope is one real venture's core board, and C2-01..05 move to Cycle 3

**Status:** accepted
**Date:** 2026-10-19
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** `myfitfolio`'s core board is green (`verify --all` exit 0 from main), or a second real venture is
blocked on a `required` slot. Either one opens Cycle 3 with C2-01 first.

## Context

The Cycle 1 PLAN named five Cycle 2 items (C2-01 to C2-05) and four Owed gaps. The owner's done line for Cycle 2 is
"myfitfolio's core board `verify --all` green from main". That line needs the 34 core slots only. C2-01 alone (35
`required` slots, each adaptered and vetted) is larger than the whole of Cycle 1, which burned 13 of 18 days with both
checkpoints firing late. Owner ruling at kickoff, 2026-10-19: "P1 + done-line Owed".

## Decision

Cycle 2 holds F1 (ADR-1765), F2 (ADR-1766), F3 (ADR-1767), and every Owed item on a core slot `myfitfolio` must cross:
- `secrets` places the runtime keys itself;
- `backup` provisions its own pooler role and `SUPABASE_DB_URL`;
- `security-headers` waits for the live build.

Two more items go with them. `legal-pages` (`arc-legal`) gets vetted, because it is a core slot with only a candidate row
(ADR-1769). The money chain also runs live on `myfitfolio`.

Moved to Cycle 3, unchanged: C2-01, C2-02, C2-03, C2-04, C2-05, and the `release` re-receipt. That re-receipt is
`arc-sandbox`'s gap, and `myfitfolio`'s `release` is already verified.

## Consequences

- The appetite is 11 days, against Cycle 1's 18.
- `myfitfolio`'s 32 `required` slots stay REFUSED through Cycle 2, and `plan` keeps printing them.

**Evidence:** owner ruling 2026-10-19 (kickoff fork 3); `myfitfolio` board 2026-10-19 (5 verified, 1 failed, 58 pending,
22 skipped); Cycle 1 burn, `archive/PROGRESS-cycle1-2026-10-15.md`.
**Confidence:** high.
