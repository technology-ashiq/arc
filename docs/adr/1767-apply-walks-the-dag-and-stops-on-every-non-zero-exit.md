# ADR 1767 — `apply --next` and `apply --all` walk the DAG and stop on every non-zero exit

**Status:** accepted
**Date:** 2026-10-19
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a walk stops on `REFUSED` for a slot that is optional by condition three times in one week. A
`--skip-refused` flag would then be considered by ADR, never added silently.

## Context

`apply` takes one slot. The owner drives `myfitfolio` with a hand-written PowerShell loop. Exit codes (`runner.mjs:18`):
0 OK, 1 FAILED, 2 REFUSED, 3 LOCKED, 4 DEPS, 5 AWAITING owner. `lib/dag.mjs` already computes a topological order
(`topoOrder`, Kahn, ties broken by catalog order).

## Decision

- The walk covers `tier: core` slots only. A core slot's `depends_on` is core-only (ADR-1717), so the filtered order is
  closed. Without the filter, `brand-kit` (required, no row) comes second in `topoOrder` and stops every real walk with
  exit 2 (kickoff attack A1).
- `apply --next` applies the first core slot in `topoOrder` that is not passed over, then exits with that slot's code.
  The state table: `verified` and `skipped` are passed over; `absent` is passed over on a rehearsal and stops a real
  venture (`stopped at {slot}: absent on real`); `failed` is retried, once per walk; `awaiting-approval` exits 5 without
  a second `approval.requested`; a slot whose condition is false is written `skipped` and counted as skipped.
- `apply --all` repeats `--next` until a slot exits non-zero or no slot is left. It stops on **every** non-zero code
  (1 to 5), not only 1, 4 and 5. A refused slot is never skipped silently, because everything downstream of it would
  only answer `DEPS`.
- On a stop, the walk prints one line, `stopped at {slot}: exit {n} {reason}`, and exits `n`. When nothing is left it
  prints `walk complete: {k} applied, {s} skipped` and exits 0.
- The walk never answers a gate. Gate slots return 5 and the walk stops there. `--again` is refused together with
  `--next` or `--all`.
- Each slot takes its own lock as today. A second walk on the same venture stops at once with exit 3.

## Consequences

- The owner's loop is replaced by one command, and the stop line says what he has to do.
- `apply SLOT` is unchanged, byte for byte.

**Evidence:** `runner.mjs:18,108-160`, `lib/dag.mjs` `topoOrder`, `arc-launch.mjs:165-166`.
**Confidence:** high.
