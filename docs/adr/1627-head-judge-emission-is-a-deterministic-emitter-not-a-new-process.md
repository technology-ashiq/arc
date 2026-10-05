# ADR 1627 — head-judge emission is a deterministic emitter (`org-judge.mjs`), not a new engine process

**Status:** accepted
**Date:** 2026-10-05
**Product:** `org`
**Reversibility:** two-way

## Context
ORG-O (ADR-1615): a department head is a judge, never a relay, and a head seat needs at least two staffed
workers. ADR-1618 deferred the actual `review.completed` emission over a worker's `handoff.ready` artifact.
Both kinds are already in the closed spine set (ADR-0026), so no new kind is needed. A new engine process
would need a policy row in `hq.policy.yaml`, which is owner-authored (ADR-1623 precedent) — a blocker on
the owner for a mechanism that only records a judgment.

## Options considered
1. **A `head-judge.process.yaml` run by `arc-run`** that both judges and emits: needs an owner policy row.
2. **`.claude/scripts/org/org-judge.mjs`**: given the head role, the worker's `handoff.ready` receipt id and
   a verdict, it checks ORG-O and emits one `review.completed`; the judging itself is the head agent's run.

## Decision
Option 2. `org-judge.mjs --head ROLE --receipt ULID --verdict accept|rework --reason TEXT [--team VENTURE]`
refuses (exit 1, named, nothing emitted) unless: the receipt exists on the spine and is a `handoff.ready`;
the receipt's role (attribution map, then `payload.role`) is a worker under that head in a team manifest's
`heads:`; the head's department has at least two staffed workers; the head is not the worker itself; and no
`review.completed` from this head already names that receipt (one verdict per artifact). The emitted payload
carries `role: <head>`, `subject_role`, `subject_receipt`, `verdict`, `reason`.

## Consequences
Easier: no policy row, no owner block; `org-review` already scores `review.completed`. Harder: with no team
manifest in the repo today (ADR-1612), the live check refuses by design until a venture team declares heads;
the fixtures prove the path with a sandbox team.
