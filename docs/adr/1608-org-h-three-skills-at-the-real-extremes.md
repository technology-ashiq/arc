# ADR 1608 — ORG-H: v1 proves the skill contract with three skills — `council-consult`, one over existing scripts, and `support-reply`

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The pilot pulls neither `outreach-draft` nor `seo-brief` in its first two days -> the second skill is whichever script-backed role it pulls first.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-H). `.claude/skills/` holds one skill today. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Three skills at the extremes** — a wrapper, a script-backed skill, a brand-new know-how skill.
2. **Twenty skills** — breadth nobody has pulled (RH-1 in skill form).

## Decision
Three. `council-consult` drafts the question and emits an `approval.requested` asking the owner to convene (it never convenes alone). The second is picked by what the pilot pulls first (`outreach-draft` over `arc-leads` or `seo-brief` over `arc-growth`). The third is `support-reply`.

## Consequences
Easier: small, real. Harder: two departments stay skill-less until pulled.
