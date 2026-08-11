# ADR 0707 — MEM-I: `arc-recall` is root-mode-first; `lane` is provenance metadata, never a requirement

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** one-way
**Revisit trigger:** a real cross-repo miss occurs (someone needed a lesson recorded in another
repo and could not reach it) **and** at least two repos are running arc — at which point
cross-repo federation is designed, from a working root-mode base.

## Context

Root-mode — no `initiatives/` directory, the repo's own `PLAN.md` is the one live plan — is a
**permanent consumer contract** (ADR-0054), not a migration shim. Every venture repo runs it, and
LexOS runs it today. Lane-mode is the arc-repo-internal arrangement.

A module that only works inside a repo with lanes would need unbuilding before it could ship to
a consumer. Building it lane-first and "adding root-mode later" is the expensive order.

This compounds with the storage decision (ADR-0701): consumer repos are exactly where the Node
version is outside our control, which is why the canonical path must run on Node ≥18.

## Options considered

1. **Lane-aware first, root-mode adapted later** — pros: matches the repo we are standing in.
   Cons: bakes an arc-internal assumption into a module intended to ship, and the adaptation is
   discovered late.
2. **Root-mode-first; lane is a field** — chosen. Pros: the general case is the default case.
   Cons: a zero-lane fixture must exist and be maintained.

## Decision

`arc-recall` runs correctly in a **zero-lane tree**. This is proven by a **fixture** in REQ-02 —
a tree with no `initiatives/` directory at all — not by inspection and not by an argument that it
ought to work.

`lane` is **provenance metadata** on a record: a field you may filter on with `--lane`, never a
thing whose absence breaks anything. Records from organs with no lane attribution simply carry no
lane, and `--lane` filtering on a zero-lane tree returns a normal empty result (exit 0, "zero
results is a result"), not an error.

v1 proves the fixture. Actual rollout to consumer repos rides the existing products install path
at its own trigger, and is **not** in this cycle.

**Confidence:** high.

## Consequences

- **Easier:** shipping memory to LexOS later is an install, not a port.
- **Harder:** every lane-touching code path needs its zero-lane branch tested, which is one more
  fixture axis on an already-tight appetite.
- This is marked one-way because retrofitting root-mode support after the module has grown
  lane-shaped assumptions is exactly the unbuilding this decision exists to avoid.
