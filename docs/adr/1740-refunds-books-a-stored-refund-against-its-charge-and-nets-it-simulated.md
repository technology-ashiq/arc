# ADR 1740 — refunds books a stored `refund.processed` against its charge, so the simulated P&L nets to zero

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the first real test refund reaches the table through the Razorpay dashboard webhook, the ledger's
razorpay parser gains a refund row shape, or a second `refunds` provider (dodo) is built

## Context

The `refunds` slot's exit criterion is "refund nets in arc pnl", and REQ-04 asks that "a test refund nets 0 in
`arc pnl`, whose line is labelled simulated". ADR-1739 left the probe payment booked as one `revenue.simulated` line
of ₹1.00 and said a simulated line "nets to zero only through `refunds`".

What the ledger already offers, read before deciding:

- A refund is its own positive revenue event carrying `refund_of` (ADR-1016 / LED-Q). `derivePnl` links it to its
  charge (same venture, same currency, not before the charge), subtracts it from cash-in in the month it was recorded,
  and flags an over-refund. `--simulated` reads only `revenue.simulated`, so a simulated refund nets a simulated charge.
- `parsers/razorpay.mjs` refuses a negative row ("a refund or chargeback row is not part of the Appendix C row shape in
  v1"). A refund amount is positive and has its own id, so it parses as a row. Only `refund_of` is added after
  `normalizeRow`, and `validate-ledger.mjs` checks it (namespaced, never itself).
- The webhook route `webhooks-ledger` committed stores every signed event once with its raw body, `refund.processed`
  included. Its `payment_id` column comes from the event's payment entity.

The row `razorpay-refunds` was written at kickoff with the Razorpay key pair and `api.razorpay.com`. It never needs
them, because a refund reaches arc the way a payment does: as a stored webhook event.

## Options considered

1. **Call `POST /v1/payments/<id>/refund`.** That needs a real captured test payment. The probe payment is a stored
   event Razorpay never saw, so this is not a probe any CI arm can answer.
2. **A route of its own.** The Razorpay dashboard webhook has one URL for `payment.captured` and `refund.processed`
   (phase-02 spec), and two routes would split one signing secret across two files.
3. **Read `refund.processed` rows from webhooks-ledger's table.** verify signs a probe refund of webhooks-ledger's
   own probe payment and delivers it through the same route. It reads back the refund entity's fields from the stored
   body on the venture and queues the refund, which the runner books through the ledger's parser with `refund_of`.

## Decision

Option 3.

- **Row:** env keys `RAZORPAY_WEBHOOK_SECRET` and `SUPABASE_ACCESS_TOKEN`, hosts the venture domain and
  `api.supabase.com`. The slot creates nothing and calls no GitHub or Razorpay API.
- **Upstream:** webhooks-ledger now reports `probe-payment` (the charge its verify books). refunds reads that and
  `supabase-ref`, and refuses `UPSTREAM_MISSING` without them. The table must carry the `arc-launch webhooks` marker
  with RLS on, or scaffold refuses `UPSTREAM_TABLE` and verify is not ok.
- **verify:** one signed `refund.processed` event (`rfnd_ArcProbe0…` derived from the slot's tag, ₹1 of the probe
  payment) is sent twice. Both deliveries must answer 200. Exactly one stored `refund.processed` row must carry that
  refund id under the probe event id, at 100 INR, refunding the probe payment. The read selects only the refund
  entity's fields (`body::jsonb #>> …`), so the body never reaches arc. Then it queues `revenue.simulated` with
  `payment_id` the refund id and `refund_of` the charge.
- **webhooks-ledger's read** narrows to `event = 'payment.captured'`. A refund row of the same payment is its own
  row, not a second delivery of the capture, and the webhooks probe must stay at exactly one.
- **simulated.mjs:** a queued entry with `refund_of` must have a `rfnd_` id and a `pay_` charge. It is booked only
  when that charge is already a `revenue.simulated` line of the same venture. It is refused when the refunds booked
  against the charge would sum past it. Otherwise it is built exactly as a payment, plus `refund_of`.
- **teardown:** nothing. The refund line stays on the append-only spine, netted.

## Consequences

- `arc pnl --simulated` shows the charge and the refund, every line `SIMULATED`, and arc-sandbox's cash-in is 0. The
  real P&L is unchanged. A replayed refund adds no event.
- The owner's dashboard webhook must include `refund.processed`. It already does in the phase-02 spec's list.
- A refund of a real test purchase lands in the same table. Booking it needs that purchase's charge booked first
  (debt D33, with `checkout-portal`).
