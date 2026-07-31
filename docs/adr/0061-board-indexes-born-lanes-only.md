# ADR 0061 — the board indexes born lanes only; QUEUED is a state a lane holds, not a promise about one that does not exist

**Status:** accepted
**Date:** 2026-08-01
**Reversibility:** two-way
**Supersedes:** the source pack's §4 board illustration on this one point.
**Amends:** nothing — it settles a contradiction that ADR-0051 and ADR-0054 create together
and leaves both unchanged.
**Revisit trigger:** three or more lanes where "what is next" stops being obvious from
`PLAN.md`, and the owner finds themselves asking the board a question it refuses to answer
→ the `Queued next:` fact line (option 2 below) gets its own ADR. A row exemption does not
come back.

## Context

`PORTFOLIO.md` v1 shipped in Phase 01 without a `develop` row, and with an HTML comment
saying the contradiction was the owner's to settle. This is that settlement.

Three accepted rules point in two directions:

- The source pack (§4) illustrates the v1 board as `portfolio LIVE · design IDLE ·
  **develop QUEUED**`, and its status vocabulary defines `QUEUED` as "scheduled next, not
  counted".
- The same pack's directory tree marks `initiatives/develop/` as *"born at its kickoff
  (first native lane)"* — next cycle — and REQ-03 rules that every initiatives row resolves
  to an `initiatives/<lane>/` directory, lint-checked. ADR-0054 gives lane creation to
  `/arc-kickoff` alone and forbids pre-scaffolding by any other surface.
- ADR-0051 makes every board value derive from that lane's PROGRESS machine header, with
  "nothing hand-copied from prose".

A `develop` row would therefore need a directory that does not exist and values derived
from a header that does not exist. Both cannot hold at once.

The timing is not incidental. Phase 02 writes the strict-grammar board lint that judges
exactly this, so the contradiction has to be settled *before* the lint is designed.
Settled after, there are only two outcomes: the new lint's first act is to flag arc's own
board, or it ships with an exception carved into its only invariant.

## Options considered

- **Add the row, exempt `QUEUED` from the directory check** — **rejected.** The exemption
  lands inside the single invariant the initiatives table has (row ↔ lane directory), and
  the row's values would be hand-typed, which is precisely the second source of truth
  ADR-0051 exists to forbid. It also puts a conditional branch into a strict-grammar
  markdown parser — this cycle's live bug class (pre-mortem risk 3), where the council
  found the same class of defect twice.
- **No row, but a `Queued next:` fact line under the table** — **rejected for v1.** It
  keeps the table pure and the foresight survives, but it buys one line of information at
  the price of a second grammar to parse, lint, and keep honest — for a fact `PLAN.md`'s
  next-cycle section already carries. Held as the named alternative in the revisit trigger.
- **The board indexes born lanes only** — **accepted.**

## Decision

1. The **Active initiatives** table holds a row for a lane **if and only if**
   `initiatives/<lane>/` exists and carries a readable PROGRESS machine header. No row is
   ever written ahead of the lane's birth. The lint's invariant stays single and
   unconditional: every initiatives row resolves to a lane directory, and every value
   derives from that lane's header.
2. `QUEUED` keeps its place in the vocabulary and its exact meaning — *scheduled next, not
   counted* — as a state a **born** lane holds in its own machine header. A lane whose
   cycle has closed and which is scheduled next writes `status: QUEUED`, and the board
   derives it like any other value. It is not a way to announce a lane that does not exist.
3. "What comes after this cycle" is `PLAN.md`'s job. The board answers a narrower question:
   *what exists, and in what priority order.*
4. A row appears in the same commit that births the lane — `/arc-kickoff` already mutates
   the board inside its tracker-update commit (ADR-0051), so no separate step is created.

## Consequences

- `develop` gets its row at `/arc-kickoff --lane develop` and not before. Until then the
  board shows two rows and the counted WIP number is 1.
- The board can never show a lane that is not there. It also can never warn about one that
  is coming — accepted deliberately: an index of what exists is not a place for a promise.
- The first strict-grammar parser this cycle ships gets one rule for the initiatives table
  instead of one rule plus an exception. That is the whole point of settling it here.
- The source pack's §4 illustration is superseded on this point, recorded here so the
  divergence is a decision on the record rather than a drift nobody wrote down.
