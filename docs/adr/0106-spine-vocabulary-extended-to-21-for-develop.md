# ADR 0106 — Spine vocabulary extended 18 → 21 for the develop lifecycle

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a fourth develop lifecycle event needs a kind, or the three added here go
unused for a full cycle — either means the set was drawn at the wrong grain.

## Context

`/arc-develop` leaves a receipt at each lifecycle transition. The first run of `start` reported
success and wrote nothing to the spine: `develop.started` was quarantined with `UNKNOWN_KIND`,
because ADR-0026 closed the vocabulary at 18 kinds and validation rejects anything outside it. The
command still exited 0, so the failure was silent — found only by listing the spine directory.

ADR-0026 is two-way and names this exact situation in its own revisit trigger: *"a real factory
action or money flow has no honest kind → extend the vocabulary via a new ADR (the only allowed
mechanism)."* Unknown kinds are a pinned hostile fixture precisely so extension is deliberate.

A build lifecycle has no honest kind among the 18. `run.completed` is the nearest, and it is not
close: a proven slice is not a completed run.

## Options considered

1. **Extend to 21** — add `develop.started`, `slice.done`, `handoff.ready`. Receipts stay
   first-class, so `/arc-resume` and the briefs group develop's work by kind like everything else.
   Costs one array entry each, one count in an error message, and a new ADR.
2. **Reuse `run.completed` / `note.logged` with a payload discriminator** — no core change, no ADR.
   Rejected: the spine would record "a run completed" when a slice was proven. Telemetry that reads
   true and means something else, in the product whose governing rule is that every record is
   computed or earned, never asserted.
3. **Drop receipts from develop** — rejected: visible progress is a third of the product promise,
   and a lifecycle nobody can audit is the gap this product exists to close.

## Decision

Option 1. The vocabulary is now closed at **21**:

- `develop.started` — a phase's Build Brief and slice ledger were written.
- `slice.done` — a slice was proven: its declared proof ran and its commit is recorded.
- `handoff.ready` — the evidence pack is assembled for `/arc-phase-done`.

The grain is deliberate: one kind per lifecycle transition that changes durable truth, not one per
command. `next` and `status` emit nothing of their own — `next` emits `slice.done` when it observes
a slice became proven, and `status` is read-only.

## Consequences

Easier: develop's lifecycle is queryable by kind, so a brief can answer "how many slices were proven
this week" without parsing payloads.

Harder: the closed set is now a number three consumers cite, and the hostile fixture that proves
unknown kinds are still rejected must be re-run — a vocabulary that grows without its rejection test
re-checked is a vocabulary that quietly stopped being closed.

What we would revisit if this goes wrong: if lifecycle events prove too fine-grained in practice,
collapse the three into one `run.completed` carrying a typed payload — but only with the payload
schema pinned by a fixture first.
