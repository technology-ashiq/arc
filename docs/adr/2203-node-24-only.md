# ADR 2203 — Node 24 only

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** Node 26 reaches Active LTS and Dependabot surfaces it.

## Context

Locked letter CI-D. Node 18 and 20 are end-of-life, 22 is in maintenance until 2027-04, and 24 is Active LTS. The owner's box runs v24.18.0.

## Options considered

1. **Keep the 18/20/22 legs.** That is three setups per push for runtimes nobody runs.
2. **Node 24 only:** `engines.node >=24` and `.nvmrc` = `24`.

## Decision

Option 2. ADR-0024's JSONL-as-truth decision is unchanged; only its "CI keeps a Node 18 leg" clause goes.

## Consequences

The suite has never run on 24 (PLAN A-01). Phase 00's first run is the probe, and a real Node-24 break is fixed in code, never skipped.
