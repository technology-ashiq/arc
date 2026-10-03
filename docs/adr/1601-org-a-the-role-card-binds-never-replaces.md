# ADR 1601 — ORG-A: the role card is the one canonical object; it binds existing things and never rewrites `.claude/agents/*.md`

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** Drift between cards and agent frontmatter is MEASURED after one full cycle of use (RH-3).

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-A). 30 agent files already declare name, tools and tier; products declare ownership. What nothing holds is mission, stage, KPI, seat, origin, reports-to, E2 exposure, tenure, produces/consumes and budget. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Bind** — a small YAML card that points at agents, skills, scripts, processes, a router tier and a policy subject.
2. **Generate agent files from cards** — single source, but rewrites 30 working files and pulls ADR-0201's generated-file machinery into every agent.

## Decision
Bind. A card references; it never copies what an agent file already says and never writes to `.claude/agents/`. Generating agent files is rabbit hole RH-3.

## Consequences
Easier: zero risk to the council's hardened prompts. Harder: two files describe one agent, so coverage (ADR-1610) must prove they agree.
