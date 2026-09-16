# ADR 1334 — ported flow assertions bind to real receipts read from the door; an op with no existing kind does not ship

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner rules a new spine kind into `validate.mjs` through its own ADR (the spine's closed set is ADR-0026's law, not this lane's) → the flows for that op re-bind to it in the same change.
**Provenance:** decided at the Cycle 16 kickoff (two-way door). It applies two LOCKED rules that meet head-on: FV2-M (ADR-1330, events are frozen strings) and the non-negotiable "zero new spine kinds", using the resolution PLAN-face-v2 §11 already wrote: "an op that needs a new one is out of scope and says so".

## Context

The 20 v0.7 flows assert 38 event kinds, read from a browser `localStorage` log. Checked against
`.claude/scripts/hq/lib/validate.mjs` KINDS (46) on 2026-09-16: **9 exist** (`idea.captured`
`approval.requested` `decision.recorded` `phase.closed` `review.completed` `qa.completed`
`incident.raised` `experiment.opened` `experiment.measured`) and **29 are design-app inventions**
(e.g. `job.registered` `tool.pinned` `tier.proposed` `lane.born` `adr.recorded`
`concept.defined` `plan.adopted` `venture.registered` `lesson.logged` `ask.answered`
`ship.completed`).

## Options considered

1. **Existing kinds stay verbatim; an invented kind re-binds to the existing kind the real CLI emits for that op, read back through the door; an op whose CLI emits no existing kind does not ship, and its flow asserts the verb is ABSENT with the read-only badge shown.**
2. **Keep flows asserting on a browser `localStorage` log** — the product has no such log; a UI-side event store is a second truth (ADR-1301, A5), so the assertion would test nothing the owner uses.
3. **Add the 29 kinds** — violates the zero-new-kinds non-negotiable.
4. **Port only the flows whose kinds already exist** — silently drops ops the owner asked for instead of labelling them.

## Decision

Option 1. The binding table (v0.7 kind → emitted arc kind | NOT SHIPPABLE) is written per ring
in Phase 05 from each op's real CLI, never from the v0.7 name, and lands beside the server ops
registry so `face-coverage` can check it.

## Consequences

- Expect a smaller shippable op set than §5.2's verb column: registration-style verbs whose CLI emits nothing (or emits a kind outside the 46) render read-only with an honest badge. That is the Block C per-op rule working, not a failure.
- Flows can no longer pass on an event the product never recorded.
