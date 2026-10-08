# ADR 1741 — a rehearsal's gate-1 and gate-3 refusal runs before dependencies and provider choice

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a gate other than 1 and 3 becomes refusal-only for rehearsals, or `payment-live` gains a provider
row and a real venture

## Context

REQ-04 ends "gate 3 emits `approval.requested` and `apply payment-live` exits 2 (refusal path proven, never
crossed)". ADR-1700/1720 say a rehearsal venture exercises gates 1 and 3 through their refusal path only. On the real
catalog, `payment-live` has no provider row and depends on `legal-pages` and `invoices-gst`, which are Cycle 2.
The runner checked dependencies (exit 4) and then the vetted provider (exit 2, "no vetted provider") before the gate.
So on arc-sandbox the gate was never reached, and the only proof was the Phase 00 fixture catalog.

## Decision

For a `rehearsal` venture, a slot whose gate is `gate-1` or `gate-3` goes to the gate first, after only the
applicability and already-verified checks. The refusal records `approval.requested` (gate, slot, provider: the one
vetted row's id, or `none`) and leaves the slot `absent`. A second apply refuses from the record. No dependency is
consulted, no adapter is loaded, and no `run.completed` is written. A non-rehearsal venture keeps the old order:
dependencies, provider, then the gate.

## Consequences

- `arc launch apply payment-live --venture arc-sandbox` exits 2 with one `approval.requested` on the real catalog, and
  a re-run adds none (launch-cli.bats).
- `domain` (gate-1) on arc-sandbox now refuses at the gate rather than at "no vetted provider". Both are exit 2, and
  the refusal is the one the plan names.
- Nothing can run on a rehearsal's gate-1 or gate-3 slot, whatever its dependencies say. That is stricter than before,
  never looser.
