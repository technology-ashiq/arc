# ADR 1626 — a process may name a `role:`; `arc-run` resolves it to one bound agent, and `--trial-seat` swaps that agent for one run

**Status:** accepted
**Date:** 2026-10-05
**Product:** `org`
**Reversibility:** two-way

## Context
ADR-1618 deferred ORG-R item 1 behind a trigger (two candidate agents for one process). The owner ruled on
2026-10-05 to build every deferred org item now, without waiting for its trigger. Role cards
(`org/roles/**/*.role.yaml`, ADR-1601) already bind `binds.agents` (a list) and `binds.process` (one stem).
`arc-run.mjs` already records a *model* seat: `seat` + `seat_source` (`none | trial | owner | routed | runtime`),
with `--trial-model` as the one-run override (ADR-0220). `org-review` scores per ROLE, not per agent, and
attributes a receipt by the attribution map first and `payload.role` second (ADR-1604).

## Options considered
1. **Reuse `seat` / `seat_source`** for the agent: one field meaning a model on some receipts and an agent on
   others — every existing reader of `seat` (cost, router tenure) would read an agent id as a model.
2. **New, separate receipt fields** `payload.role`, `payload.role_agent`, `payload.role_agent_source`
   (`card | scored | trial`), leaving the model seat untouched.

## Decision
Option 2.
- `process-lint` admits one new top-level key, `role:` (a role id). It FAILs unless that card exists and its
  `binds.process` names this process — the link is checked in both directions, so a card and a process cannot
  disagree about who runs it.
- `arc-run` resolves the agent deterministically: among the card's `binds.agents`, the agent with the most
  `run.completed` ok receipts carrying `payload.role_agent` wins (`scored`); a tie or no evidence takes the
  FIRST listed agent (`card` — the card's order is the owner's preference). Never random, never by recency.
- `--trial-seat <agent>` replaces the resolved agent for this invocation only; the agent must be listed in
  `.claude/agents/`, and the receipt says `role_agent_source: trial`. Like `--trial-model`, given twice or
  with an empty value it is an operator error (exit 2), and it writes nothing to the card.
- The resolved agent's file body (frontmatter stripped) reaches the driver as the run's seat persona, so a
  trial seat changes what runs, not only a label.

## Consequences
Easier: "same process, different agents" is one flag; `org-review` attributes these runs by `payload.role`
with no new attribution rule. Harder: `process-lint` and `arc-compile` gain one key each, and every compiled
command whose process gains `role:` must be regenerated in the same commit.
