# ADR 1607 — ORG-G: every staffed seat carries 30-day tenure and every review ends in keep, promote, retrain or retire

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The first `org review` finds 30 days too short to hold any evidence for most seats -> the period moves by ADR, never by edit.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-G), period left to kickoff. ADR-0216: every hire is planned obsolescence, `review_by` enforced at load. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **30 days** — matches the monthly review.
2. **90 days** — more evidence per review, but a bad seat lives three months.

## Decision
30 days, own or hired. `org review` proposes exactly one of keep · promote · retrain · retire. Propose-only both ways; never auto-renew, never auto-fire — except A4's existing automatic demotion on incident, which is not re-implemented.

## Consequences
Easier: one clock for everything. Harder: many early reviews will print `no evidence` — that is the honest answer.
