# ADR 1760 — `apply --again`, and the in-attempt verify reads what scaffold reported

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a gated slot that has to be re-applied (it needs its own gate decision path, not this flag)

## Context

Three defects came out of the first real Phase 01 to 03 runs on `arc-sandbox`:

1. **A verified slot could not be re-applied.** `apply` no-ops a verified slot. The ADR-1755 release fix and the
   ADR-1759 pins both needed a verified slot to run again, and its receipt kept stale evidence.
2. **The verify in the same attempt read a snapshot.** The worker built ctx once, before scaffold, so verify read the
   slot's resources as they stood before this attempt reported anything. `payment-test` and `ledger-source` failed
   attempt 1 with "state records 0". `payment-test`'s retry then created a second Razorpay test order.
3. **Two recorded orders failed `payment-test` for good**, because its verify demanded exactly one.

## Decision

- `apply <slot> --again` re-runs a VERIFIED slot as a new attempt with its own receipt. It is refused for any other
  state, where a plain apply already runs it. It is also refused for a gated slot: a re-run must neither reuse nor
  re-ask an owner's gate decision.
- The worker hands verify a ctx whose `resources` are re-read from state after scaffold.
- `payment-test` verify stands on the newest recorded order and requires every recorded id to be an order id.
  Teardown still lists every one.

## Consequences

`release` on `arc-sandbox` still carries its pre-ADR-1755 ERROR evidence: it is gated, so `--again` refuses it.
Re-receipting it waits for a gate-aware path. Pinned by `launch-cli: the first attempt verifies on what its scaffold
reported, and --again re-applies only a verified, ungated slot (ADR-1760)`, and by the `two-recorded` arm of
`launch-contract: payment-test verify is not ok for ...`.
