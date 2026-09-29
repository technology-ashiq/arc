# ADR 1617 — ORG-Q: every card declares `produces`, `consumes` and `escalate_to`; an unproduced consumed kind FAILs coverage

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The pilot's chain needs a handoff that no single artifact kind expresses -> the schema grows by ADR.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-Q). MetaGPT/ChatDev: "Code = SOP(Team)" — named artifacts, not messages. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Declared artifacts + coverage** (REQ-13).
2. **Implicit handoffs** — a team manifest becomes a list of titles.

## Decision
`produces: {kind, schema, receipt: handoff.ready}`, `consumes: [kinds]`, `escalate_to: <head> | human:ashiq`. Schemas are markdown under `docs/schemas/`, written only for the pilot's chain in v1 (RH-4).

## Consequences
Easier: a team is provably a chain. Harder: vacant stubs need `produces` too — stubs declare it, even when nothing is bound yet.
