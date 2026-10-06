# ADR 1736 — payment-test proves test-mode keys with one tagged order; the purchase is checkout's

**Status:** accepted
**Date:** 2026-10-07
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Razorpay offers a server-side test payment that needs no checkout page, or a second
`payment-test` provider (dodo) is built

## Context

Phase 02's `payment-test` slot (exit criterion "test-mode purchase + refund e2e") runs before `checkout-portal`,
`webhooks-ledger` and `refunds` in the DAG. Razorpay has no server-side call that completes a test payment: a test
purchase goes through the Checkout page with a test card or UPI id. So the slot that runs first cannot buy anything.
The `razorpay` row holds only `api.razorpay.com` and the two key names. Gate 3 (`payment-live`) must never be crossed
on `arc-sandbox` (ADR-1700, ADR-1720).

## Options considered

1. **payment-test drives a real purchase itself** — it would need the checkout page that a later slot builds, and a
   browser. That inverts the DAG.
2. **payment-test proves the account and keys, and the purchase e2e is proven where it can happen** — the slot checks
   the keys are TEST keys, creates one tagged order, and verify fetches that order back from Razorpay. The purchase
   and refund are proven by `checkout-portal` → `webhooks-ledger` → `refunds`, where the page exists. That chain is
   REQ-04's acceptance.

## Decision

Option 2.

- **Keys:** `RAZORPAY_KEY_ID` must be `rzp_test_` followed by 14 letters or digits. A `rzp_live_` id refuses
  `LIVE_KEY` before any call. This slot never handles live keys, so it cannot reach past gate 3. `RAZORPAY_KEY_SECRET`
  must be 16 to 64 letters or digits. Neither value is printed.
- **scaffold:** look for launch's order first (`GET /v1/orders?receipt=<receipt>`), and create it only when it is
  missing. It is ₹1 (100 paise), INR, with `receipt` = `arc-launch-` plus the venture slug (cut to 40 characters, the
  Razorpay limit) and `notes.arc_launch_tag` = the resource tag. An order with that receipt but no matching tag is the
  owner's: it refuses `FOREIGN_ORDER` and is never adopted. Reports `razorpay-test-order <order id>`.
- **verify:** Razorpay answers `GET /v1/orders/<id>` for the recorded order. Its `notes.arc_launch_tag` is this slot's
  tag, its amount is 100 and its currency is INR. The evidence names the key mode (`test`), never the key.
- **teardown:** none. Razorpay cannot delete orders, and a test-mode order moves no money.

## Consequences

- The slot's exit criterion is met by the chain, not by this slot alone. The board shows payment-test verified once
  the account answers in test mode, and REQ-04 still needs refunds' net-zero line.
- A test order sits in the owner's Razorpay test dashboard, labelled with its receipt.
- `dodo` (merchant of record) gets its own ADR when it is built.
