# ADR 1913 — discover gets no `hq.policy.yaml` row until it is an engine process

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** a discover step runs through `arc-run` as `processes/discover-*.process.yaml`; that file and its `process:` row land in the same PR.

## Context

DIS-F (ADR-1906) and the Phase 00 spec put a `process:discover` row in `hq.policy.yaml` "with the first emission (POL-I)". Building it on 2026-10-06 showed that every row in that file governs an engine process: `subjects.mjs` resolves `process:NAME` against `processes/NAME.process.yaml`, and `run-gate.mjs` authorizes only those. `--process discover` on `arc-event emit` is a label on the receipt, and nothing reads a policy row for it. ADR-1011 (ledger) refused the same row for the same reason, and launch shipped with no `process:launch` row.

## Options considered

1. **Add the row anyway.** It matches the spec, but it is a subject with no process: a self-authorizing ceiling nothing enforces.
2. **No row.** discover's only engine-run step, the council session, already runs under `process:council-convene`, which has its row.

## Decision

Option 2. ADR-1906's policy clause and the spec's birth row are superseded by this ADR. The birth test asserts discover adds no ungoverned process instead.

## Consequences

The birth PR touches one less shared file. When a discover step becomes an engine process, the row lands with it.
