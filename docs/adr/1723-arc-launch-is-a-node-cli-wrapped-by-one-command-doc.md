# ADR 1723 — `arc launch` is a node CLI wrapped by one hand-written command doc

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

Generated commands come from `processes/*.process.yaml`; touching that pipeline per PR costs a compile and a wiki regen.

## Options considered

1. **A compiled process command** — governed / the compile pipeline in every PR.
2. **`.claude/scripts/launch/arc-launch.mjs` + a hand-written `/arc-launch` command doc**.

## Decision

Option 2. CLI is the contract (ADR-0024); the face Launch room stays `planned` (C2-05).

## Consequences

One new command doc; the wiki regenerates once for it.
