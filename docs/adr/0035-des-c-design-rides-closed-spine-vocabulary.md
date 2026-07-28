# ADR 0035 — DES-C: design rides the closed spine vocabulary, no new event kinds

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** one-way
**Revisit trigger:** same as ADR-0026's own — a vocabulary change requires its own ADR plus a schema migration; design never forces one alone.

## Context

The event spine's 18-kind vocabulary is CLOSED (ADR-0026, Cycle 2). Design produces
reviews, decisions, and outcome notes that must land as receipts. Superseded-record
row 10 killed a proposed `design.reviewed` kind.

## Options considered

1. **Ride existing kinds** — `review.completed` payload `{"lens":"design"}` · pick + prediction as `decision.recorded` · outcome evidence as `note.logged`. Con: design events are distinguished by payload, not kind.
2. **New `design.*` kinds** — self-describing. Con: breaks ADR-0026's closed vocabulary; every consumer (reader, brief, inbox, replay) needs migration.

## Decision

Option 1. The vocabulary stays closed; payload `lens` discriminates. Consumers already
read payloads through the single reader (ADR-0030), so no consumer changes.

## Consequences

Easier: zero spine changes; design receipts visible in brief/reader from day one.
Harder: querying "all design events" filters on payload, not kind — acceptable, the
reader owns that.
