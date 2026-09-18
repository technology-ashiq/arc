# ADR 1403 — DSV-D: the viewport set derives from the brief's platform contract

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a brief declares a surface the viewport map has no entry for — the map is
then under-specified and needs a row, or the contract needs a narrower vocabulary.

## Context

[ADR-0036](0036-des-d-brief-carries-four-contracts.md) made the brief carry a **platform
contract**, and made coverage contract-driven rather than tier-driven. Cycle 3 then rendered
desktop only. A platform contract the pipeline never renders is a contract nobody signed:
the declaration existed, nothing consumed it, and no part of the loop could report the gap.

## Options considered

1. **Keep a fixed viewport list in the runner** — pros: simplest / cons: reintroduces exactly
   the blunt heuristic ADR-0036 superseded (row 7 of the v1 superseded record).
2. **Derive the set from the brief's declared platform contract** — pros: the declaration
   becomes load-bearing / cons: a malformed contract now breaks a run.

## Decision

Option 2. Desktop **1440×900** always; mobile **390×844** additionally when the platform
contract declares mobile `yes`. The critic judges **every** rendered viewport.

A **declared-but-unrendered surface is a run gap that blocks PASS**. This is the control that
makes the contract real: something now asserts the declaration was honoured, which is the
question this repo has learned to ask of every mandated artifact.

## Consequences

Easier: mobile stops being invisible, and coverage is derivable rather than remembered.
Harder: a brief that declares a surface casually now costs a render per variant per iteration,
which multiplies against [ADR-1401](1401-dsv-b-the-composer-sees-its-own-work.md)'s capture
budget — a mobile-declared lexos-class explore is up to 36 captures.
