# ADR 1916 — A rejected winner's tokens ride its `approval.requested`, not the decision

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

REQ-02 and REQ-05 put `cluster_fp` and the token set on the reject's payload. DIS-G (ADR-1907) reads rejects from the spine. Building the reader showed that `decision.recorded` is closed to `decides · verdict · reason` (`validate.mjs` `assertDecision`), and the owner writes it with `arc-inbox approve|reject`, which carries no discover fields. `approval.requested` is an open payload, and every decision names its request in `decides`.

## Options considered

1. **Extend `decision.recorded`.** That is a company-organ change, and DIS-F forbids it.
2. **Put the fingerprint on the request.** discover's winner request carries `gate: "discover-winner"`, `cluster_fp` and `cluster_tokens`. The reader joins `decision.recorded{verdict: reject}` → `decides` → that request.

## Decision

Option 2. `readRejects()` in `.claude/scripts/discover/lib/spine.mjs` is the only reader, and it goes through the spine reader. Phase 03's writer emits the same shape. One fixture is loaded by both the reader test and the writer test.

## Consequences

A reject recorded against any other gate is ignored, so a decision with nothing discover-shaped to match cannot block a cluster.
