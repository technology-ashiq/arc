# ADR 1618 — ORG-R: the process `role:` slot, `arc skill import`, head-judge emission and the hire-to-own command are v2, each with a trigger

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** Any of the four triggers below fires -> an `/arc-change` in a later cycle, never inside v1.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-R). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Defer with written triggers**.
2. **Build now** — scope creep into 13 process files, an import path and a new command.

## Decision
Deferred. (1) Process `role:` slot + `--trial-seat` — trigger: the pilot records ≥1 role with two candidate agents for the same process. (2) `arc skill import` — trigger: the demand counter hits 3 on a role whose know-how exists as a public skill (ToxicSkills threat model). (3) Head-judge emission — trigger: two staffed workers under one head. (4) Hire-to-own command — trigger: the second manual rewrite.

## Consequences
Easier: v1 stays inside appetite. Harder: nothing.
