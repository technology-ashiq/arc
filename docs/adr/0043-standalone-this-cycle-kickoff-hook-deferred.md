# ADR 0043 — design module ships standalone this cycle; the kickoff step-4.5 hook is a follow-on /arc-change

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** the module completes one clean end-to-end run (brief → critique with receipt) → wiring the router hook into arc-kickoff.md becomes due via /arc-change.

> **FIRED 2026-07-29** — the Phase 02 explore run `hq-dashboard-v1` went brief → render →
> critique → receipt with nothing hand-carried, and the design ledger stamped twice. Routed
> → issue **#60**. The condition for *considering* the wiring is met; the shape of the
> wiring is still open — a hook that fires on every kickoff, including ones with no UI
> surface, would be worse than no hook. Owner's call.

## Context

Owner fork at kickoff. The original build-order sketch had Phase 1 editing the shared
`arc-kickoff.md` (step 4.5: auto-invoke brief mode for UI-bearing builds). That file is
shared infra used by every future OS-track build and is mid-hardening (kickoff-lint v4
gates still in WARN TRIAL).

## Options considered

1. **Standalone this cycle** — brief mode callable manually; router hook lands later via /arc-change after one clean run. Con: a UI-bearing kickoff this cycle must remember to call it.
2. **Full auto-wire now** — per original sketch. Con: a mistake's blast radius = every future kickoff, in the same cycle the module itself is unproven.

## Decision

Option 1 (owner's call, recommended default). Blast radius stays inside the module.

## Consequences

Easier: arc-kickoff.md untouched (also a PLAN no-go). Harder: manual invocation until the
/arc-change lands — acceptable for one cycle.
