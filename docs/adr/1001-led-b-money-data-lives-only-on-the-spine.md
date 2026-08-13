# ADR 1001 — LED-B: money data lives only on the spine; the only config file is ventures.yaml

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a money fact arrives that is genuinely not an event — a standing balance or
an opening position with no originating transaction — which the spine cannot represent without
inventing a timestamp.

## Context

A P&L needs revenue and costs. Both are already representable as spine events
(`revenue.received`, `revenue.simulated`, `cost.incurred` are all live in the vocabulary today,
verified 2026-08-12). The convenient alternative is a `costs.yaml` beside the code holding
subscription figures, because editing a YAML file is easier than emitting an event.

That convenience creates a second money store. Two stores means the reconciliation gate
(LED-F) can only reconcile one of them, and `rm derived -> replay` reproduces one of them.

## Options considered

1. **Spine-only** — revenue and costs are events; `ventures.yaml` holds kill criteria and no money.
2. **`costs.yaml` for declared fixed costs** — easy to edit; invisible to replay, invisible to
   reconciliation, and its edit history is git rather than receipts.
3. **Hybrid: spine for revenue, file for costs** — the worst of both, because the P&L bottom line
   then straddles two stores with different durability and different audit trails.

## Decision

Option 1. Money data lives ONLY on the spine. Declared fixed and subscription costs are monthly
`cost.incurred` events, entered the same way every other receipt is. The only configuration file
ledger owns is `ventures.yaml`, and it carries **criteria, never money** (LED-I, ADR-1008).

The reason that carried the most weight: reconciliation (LED-F) is the safety net for every
ingest mistake, and it can only be a net under numbers it can see.

## Consequences

Easier: one store, one audit trail, one replay. Every cost line has a receipt and a timestamp,
so "when did this subscription start costing us" is answerable rather than a git-blame exercise.

Harder: recording a fixed monthly cost is an emission, not a text edit — a deliberate friction.
Twelve months of a subscription is twelve events, which is correct: a cost that stopped in March
should not be inferable only from a file's absence of a line.

If this goes wrong — the monthly emission ritual is skipped and Overhead silently under-reports —
the reconciliation gate does not catch it, because reconciliation is per-revenue-rail. That gap
is named in the pre-mortem and mitigated by rendering declared-cost coverage per month rather
than a bare total.
