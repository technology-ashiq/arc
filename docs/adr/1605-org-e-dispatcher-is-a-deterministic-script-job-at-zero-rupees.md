# ADR 1605 — ORG-E: the dispatcher is a deterministic script-job at ₹0 that only proposes

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** Owner accept rate over the five pilot days is below 50% -> the dispatcher stays L1, misses are classified in retro; a model-written proposer is a later cycle.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-E). `hq.jobs.yaml` has `monthly_ceiling_inr: 0`; a `type: process` job needs `budget.inr` and would breach it. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Deterministic script-job** — arithmetic over the team manifest, stage exit criteria and the spine.
2. **A boss agent / model** — richer proposals, but costs money, adds a policy subject and invites relay chains.

## Decision
A `type: script` job on a scheduler heartbeat. It emits **proposals only** (`approval.requested`, profile `org.dispatch`, payload `{role, task, goal_ancestry: [mission, stage, exit_criterion, task], budget, why_now}`), actor left as `scheduler:org-dispatch`. **Goal ancestry on every proposal, queue cap 7/day, budget-capped seats skipped, no agent-to-agent calls, no execution, no policy subject** (ADR-0703 reader-only pattern; ledger ADR-1011 and bench ADR-0912 precedent).

## Consequences
Easier: ₹0 and fully testable. Harder: blunt proposals — measured, not assumed, by REQ-08.
