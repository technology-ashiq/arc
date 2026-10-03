# ADR 1701 — LAU-A: a slot is a contract, a tool is a row

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a slot whose exit criteria cannot be written without naming a tool

## Context

A venture needs an ordered list of capabilities, each with a proof of done, and a free choice of tool per capability. If the two live in one file, a tool change edits the process. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **One catalog of slots-with-tools** — one file / every tool swap is a process change.
2. **Slots in `launch.slots.yaml`, tools in `launch.providers.yaml`** — layer 1 never moves when layer 2 does / two files to keep in step (the lint does it).

## Decision

Option 2. Each slot row carries `tier · exit_criteria[] · verify · depends_on[] · gate · approval · timeout · resume · required_when · optional_for[]` and never a provider id. A provider row never redefines exit criteria. `launch-lint` refuses both.

## Consequences

Adding a slot is an ADR plus a row plus at least one provider row (`slot-without-provider`). Adding a tool is a row plus an adapter.
