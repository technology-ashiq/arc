# ADR 1745 — legal-pages observes the live pages, a named ABSENT is a recorded outcome, and launch never publishes

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the legal lane gives launch a publish path that keeps the owner's gate, or a second slot's exit
criterion names an ABSENT

## Context

The exit criterion is "legal.publish receipt or ABSENT: legal renderer not ready". arc-legal renders pages, and
publishing them is the owner's permanent human gate (legal REQ-06, `targets.publish: []`). Until now verify had no way
to answer a named ABSENT. Only a rehearsal gate refusal wrote state `absent`.

## Decision

- The adapter creates nothing. verify reads `/privacy` and `/terms` on the live site with bounded reads:
  - Both served as arc-legal pages, each with a closed `<!-- clause:ID -->` pair: verified.
  - Both answered 404: `{ ok: false, absent: "legal renderer not ready: ...", answerer: <domain> }`.
  - Anything in between (one page, a non-arc-legal page, an error, unreachable): not ok.
- The worker records `state: absent`, with `reason: ABSENT(<text>)` and the answerer, only when two things hold: the
  slot's own `exit_criteria` contain the word ABSENT, and verify named an answerer. Otherwise the answer is a plain
  failure.
- The runner receipts the outcome as `run.completed` with payload `outcome: absent` and exits 0. Dependents treat
  `absent` as settled, as they already did.

## Consequences

- An adapter cannot mark any other slot absent. The permission comes from the catalog row, which the owner owns.
- The contract suite runs the real worker both ways. With the catalog's own row, it records `absent`. With the row
  edited to drop the ABSENT clause, it records `failed`.
