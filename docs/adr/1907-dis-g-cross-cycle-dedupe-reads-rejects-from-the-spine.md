# ADR 1907 — DIS-G: cross-cycle dedupe reads rejects from the spine

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source (DIS-G). Fired by the owner ruling (ADR-1900). A rejected idea that comes back silently re-scored wastes a council session and the owner's attention.

## Options considered

1. **A `rejected-ideas.json` side store.** Simple, but a second truth that drifts from the spine.
2. **Read `decision.recorded` rejects through the spine reader.**

## Decision

Option 2. A cluster whose token set matches a rejected cluster's fingerprint (stored in the reject's payload as `cluster_fp`) is listed as `previously rejected <receipt id>`, and it is never re-scored silently.

## Consequences

Before Phase 02 emits any decision, the payload shape of the reject is fixed in Phase 00's fixture, so the reader and the writer are tested against one shape.
