# ADR 1616 — ORG-P: every seat has a budget line in the team manifest, spent amount derived from `cost.incurred`; over cap = stop and propose

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** `cost.incurred` receipts cannot be placed on roles by the map for the pilot's seats -> budget reads `no evidence` and the cap is enforced on proposal count instead, recorded in retro.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-P). Paperclip's per-agent budget breaker, arc-style, zero kinds. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Manifest budget, spine-derived spend**.
2. **Typed spend counters** — a second truth beside the spine.

## Decision
`budget: {tokens_month, inr_month, cap_action: stop-and-propose}` per seat. Over cap, the dispatcher stops proposing that role and emits one `approval.requested` (`org.dispatch`, `why_now: budget-cap`). Nothing is killed, nothing auto-renews. Budgets are caps, not salaries.

## Consequences
Easier: cost per role is a scorecard column. Harder: only as good as `cost.incurred` coverage today.
