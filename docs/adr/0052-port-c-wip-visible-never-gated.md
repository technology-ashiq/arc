# ADR 0052 — PORT-C: WIP is visible, never gated

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

Parallel lanes create work-in-progress risk: too many open cycles stall each other. The
v2–v3 pack drafts had a blocking WIP gate at kickoff; the owner removed it in round 4.
Source pack: `docs/strategy/plans/PLAN-portfolio.md` §3.4, §5 PORT-C, **owner-locked
2026-07-29 (round 4)**.

## Options considered

- Blocking WIP gate at kickoff (limit 2, override ceremony) — rejected (§14): the machine
  must not gate the owner in an owner-serialized company; every kickoff is already the
  owner's own recorded decision; house law says new enforcement starts advisory, never
  day-one BLOCK.
- Visible counted number, no gate — accepted.

## Decision

Lane statuses: **LIVE** (executing) · **BLOCKED** (waiting on owner/external — still
counted: it holds attention) · **QUEUED** (not counted) · **IDLE** (not counted). The
counted number = LIVE + BLOCKED, a computed fact on the board. `/arc-kickoff` preflight
prints it as ONE info line and **always proceeds** — no STOP, no ask, no override
ceremony. Working guideline stays **2**; both counted lanes BLOCKED is the signal to
clear owner items first.

## Consequences

- Promotion to any enforced gate only via retro evidence under trial-ledger discipline
  (enforcement must be earned) — see Assumptions ledger A4.
- REQ-03 fixtures must assert the preflight proceeds at ANY count, including 2+.
