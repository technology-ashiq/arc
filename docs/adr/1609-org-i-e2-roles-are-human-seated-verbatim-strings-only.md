# ADR 1609 — ORG-I: human seats are first-class; any role with a non-empty `e2` can only be seated `human:ashiq`

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** `hq.policy.yaml`'s `ungrantable_actions` list changes -> the card grammar follows it the same day, because the gate reads that list rather than a copy.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-I). Constitution E2 and `hq.policy.yaml` `ungrantable_actions` name five actions only the owner may take. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Verbatim strings, derived where possible** — `e2:` holds only the five verbatim strings; where a role binds a process, `e2` is derived from that process's policy row.
2. **Free-text e2** — easy to write, trivially evaded (`e2: [publish]`).

## Decision
Verbatim, read from `hq.policy.yaml` at gate time. Non-empty `e2` ⇒ `seat: human` (`human:ashiq`), FAIL-FROM-BIRTH. Owner-choice human seats are marked `human (owner choice)`. Social and launch/PR carry "publishing under Ashiq's name" only when the card's byline says so.

## Consequences
Easier: E2 cannot leak through a friendly role. Harder: roles that prepare E2 work must split preparing from deciding.
