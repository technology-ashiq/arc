# ADR 0309 — EVO-H1: the experiment vocabulary extends the closed kind list, by ADR

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** one-way
**Revisit trigger:** a lifecycle step is discovered that none of the eight kinds can represent.
That is a new kind by a new ADR — never a new field bolted onto an existing payload.

## Context

The spine's event vocabulary is closed (ADR-0026): `KINDS` at
`.claude/scripts/hq/lib/validate.mjs:20` currently holds 22 entries, and anything outside it is
rejected `UNKNOWN_KIND`. Evolve's eight lifecycle receipts (ADR-0304) therefore cannot be emitted
until the vocabulary is extended.

There is direct precedent for exactly this move: ADR-0106 and ADR-0107 extended the same closed
list for the `develop` lane, taking it to 22.

This is one-way because a kind, once emitted, is in replayable history forever. Removing it would
invalidate every receipt carrying it.

## Options considered

1. **Reuse `note.logged` with a discriminator in the payload.** Cons: decision-critical
   experiment data would ride a free-form payload, which ADR-0304 forbids for exactly this reason.
2. **Open the vocabulary generally** so lanes can add kinds without an ADR. Cons: the closed list
   is the control that makes replay meaningful; opening it removes the control to save paperwork.
3. **Extend the closed list by ADR with a frozen kind list and one validator per kind.** Chosen.

## Decision

The eight kinds frozen in ADR-0304 — `experiment.opened`, `experiment.assigned`,
`experiment.measured`, `experiment.verdict`, `promotion.proposed`, `experiment.promoted`,
`experiment.rolled_back`, `experiment.closed` — are added to `KINDS`, each with its own
closed-payload validator, in **evolve Phase 0**.

The list is **frozen here**. New kinds require a new ADR; they never arrive as new payload fields
on an existing kind (this is the event-grammar-creep rabbit hole named in `PLAN.md`).

`metric.observed` is **not** in this list — it belongs to the client's cycle (ADR-0308).

**A wiring assertion is mandatory, not optional.** The 2026-08-02 `develop` retro entry records a
receipt emitter that reported success while every receipt was silently quarantined
`UNKNOWN_KIND`, discovered only by listing the spine directory by hand. So Phase 0's exit
criteria require, for each new kind: emit, then confirm the receipt landed in `events/` **and**
that `events/_quarantine/` gained nothing. Exit 0 from a fire-and-forget writer is not evidence
that anything was written.

## Consequences

**Easier.** Replay stays meaningful because the vocabulary stays closed, and each kind's payload
is validated rather than conventional. The `develop` precedent means the extension mechanism is
proven.

**Harder.** Eight validators plus hostile fixtures in Phase 0, and the count in `KINDS` moves
from 22 to 30 — anything that hardcodes 22 will drift. The 2026-07-22 `arc-orchestrator` retro
entry is precisely this failure (docs hardcoding counts a script already reports), so the
extension must grep for the literal 22 across docs and tests rather than assume the constant is
read everywhere.
