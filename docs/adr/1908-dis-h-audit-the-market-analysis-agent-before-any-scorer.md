# ADR 1908 — DIS-H: audit `saas-market-analysis-agent` before any scorer code

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** the memo finds scoring the agent already does. Then the owner chooses port or rebuild before Phase 01 opens.

## Context

Locked in the design source (DIS-H). Fired by the owner ruling (ADR-1900). Opportunity-Scout (ADR-0022) has not moved since July, so its audit is retired. The owner's own `saas-market-analysis-agent` is a multi-agent pain scraper and SaaS-potential scorer. **Kickoff verification: the agent was not found** in the arc repo, under `E:/Work_Hub`, `~/orca/workspaces`, `~/Documents` or `~/Downloads` (depth 3), and nothing in arc references its path except the plan docs.

## Options considered

1. **Build the scorer and audit later.** Fast, but it risks duplicating the owner's working scoring.
2. **Memo first.** If the agent already covers scoring, propose port-not-duplicate and STOP for the owner's call.

## Decision

Option 2. Phase 00 step 3 writes `initiatives/discover/evidence/phase-00/market-agent-audit.md`, covering what it scores, on what signals, at what weights, under what license and deps, and what is portable. If the owner cannot give the location, the memo records `NOT LOCATABLE` with the searched paths, and Phase 01 builds the scorer from the design source alone (A-01).

## Consequences

The owner gives the agent's location in the Phase 00 opening message.
