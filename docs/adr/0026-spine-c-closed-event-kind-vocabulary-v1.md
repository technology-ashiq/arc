# ADR 0026 — SPINE-C: Closed event-kind vocabulary v1 (18 kinds)

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** two-way
**Revisit trigger:** a real factory action or money flow has no honest kind → extend the
vocabulary via a new ADR (the only allowed mechanism). Unknown kinds are a pinned hostile
fixture, so extension is deliberate, never drive-by.

## Context

Event taxonomies grow without bound unless closed; the design source names taxonomy
bikeshedding a rabbit hole. Validation (strict mode exits 2 on unknown kind) requires an
enumerable set.

## Options considered

1. **Closed set of 18 kinds, extensions only via ADR** — chosen.
2. **Open/free-form kinds** — rejected: unvalidatable, consumers can't rely on semantics,
   brief grouping becomes guesswork.
3. **Namespaced hierarchy (e.g. `factory.review.*`)** — rejected: premature structure,
   invites growth; flat closed set is enough for every named consumer this cycle.

## Decision

Event-kind vocabulary v1 is CLOSED at 18 kinds (PLAN Appendix A, verbatim from the design
source):

`idea.captured` · `council.verdict` · `approval.requested` · `decision.recorded` ·
`kickoff.done` · `phase.closed` · `review.completed` · `qa.completed` · `commit.done` ·
`ship.done` · `revenue.received` *(real money only)* · `revenue.simulated` *(never in P&L)* ·
`cost.incurred` · `run.completed` · `incident.raised` · `redaction.applied` ·
`day.closed` · `note.logged`

`revenue.received` and `revenue.simulated` are distinct kinds by design — real and simulated
money never share a kind (REQ-07 honesty rule).

## Consequences

- Strict-mode validation rejects unknown kinds (exit 2); hook mode quarantines them.
- Anything not covered is expressed as `note.logged` or waits for an ADR — no silent growth.
- Consumers (brief, inbox, future dashboard) can switch on `kind` with total coverage.
