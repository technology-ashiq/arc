# ADR 1739 — webhooks-ledger stores each signed event once on the venture, and books it as simulated revenue through the ledger's own parser

**Status:** accepted
**Date:** 2026-10-07
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the ledger lane gains a webhook-shaped ingest of its own (then launch calls it instead of building
a one-row export), a second `webhooks-ledger` provider (dodo) is built, or the first real test purchase reaches the
table through `checkout-portal`

## Context

Phase 02's `webhooks-ledger` slot has the exit criterion "round-trip receipt; replay = one event", and REQ-04 asks that
a test purchase reach the books "labelled simulated", through "a launch-owned simulated path (imports
`lib/ledger/normalize.mjs` and the razorpay parser, emits `revenue.simulated` with idem = payment id;
`ledger-ingest.mjs` is not called)". Razorpay refuses localhost and tunnel webhook URLs, so the webhook must land on the
deployed venture: `X-Razorpay-Signature` is HMAC-SHA256 of the raw body, and `x-razorpay-event-id` names the delivery,
so a redelivery carries the same id.

What the ledger already offers, read before deciding (the phase's rabbit-hole rule):

- `arc-event ingest <kind> --json F` treats a payment as an external fact: its idem is its content, with no time in it,
  and `revenue.simulated` is a member of the closed kinds (ADR-0026) and of `LEDGER_REVENUE_KINDS`.
- `validate-ledger.mjs` closes the revenue payload: `amount currency venture provider provider_payment_id` and the
  optional `gross fees tax net plan interval customer_ref fx refund_of`. No other key is accepted, so `honesty_class`
  cannot ride on a revenue event. The kind is the label: `arc pnl --simulated` reads only `revenue.simulated` and
  watermarks every line `SIMULATED`, and the real view never reads it.
- `parsers/razorpay.mjs` parses a settlement export (CSV, pinned header), not a webhook body. `normalize.mjs` turns one
  parsed row into the payload. Neither needs a ledger-lane change to take one payment, so A-07 holds.

The row `razorpay-webhook` was written at kickoff with `api.razorpay.com` and `sandbox.automemory.ai` and the three
Razorpay keys. It could not write the venture's table or commit its route. The slot depends only on `payment-test`,
which reports a Razorpay order and nothing about the venture's repo or database.

## Options considered

1. **The adapter emits `revenue.simulated` itself.** An adapter imports nothing (ADR-1715) and may queue only
   `note.logged` (ADR-1719), so it could not run the ledger's parser, and it would hand-build a money payload.
2. **`ledger-ingest.mjs` over a generated export.** It is plan-bound (`--dry-run`, then `--expect`), writes only
   `revenue.received`, and REQ-04 rules it out by name.
3. **The adapter proves the round trip on the venture and queues the stored payment; the runner books it through
   the ledger's own parser and normalizer, then `arc-event ingest`.** The adapter stays four functions with no money
   logic, and the only path from a stored payment to the spine is the ledger's own code.

## Decision

Option 3.

- **Row:** `razorpay-webhook` keeps `sandbox.automemory.ai` and gains `api.supabase.com` and `api.github.com`. Its env
  keys become `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_ACCESS_TOKEN` and `GITHUB_TOKEN`: this slot calls no Razorpay API,
  so the Razorpay key pair and `api.razorpay.com` leave the row. The slot gains `depends_on: plans`, and reads the
  venture repo and Supabase ref that `plans` re-reports (the `authz` → `plans` pattern, ADR-1737). It re-reports both
  for `refunds` and `ledger-source`.
- **Files:** `providers/webhooks-ledger/razorpay-webhook.mjs` (the adapter), and
  `.claude/scripts/launch/lib/simulated.mjs` (the simulated path REQ-04 names). `ctx.emit` accepts `revenue.simulated`
  as well as `note.logged`. The runner hands a queued `revenue.simulated` to `simulated.mjs` and never to the plain
  emitter.
- **Migration** (marked `-- arc-launch migration: webhooks`): `public.razorpay_webhook_events (event_id text primary
  key, event text not null, payment_id text, amount bigint, fee bigint, currency text, paid_at timestamptz, body text not
  null, received_at timestamptz)`. RLS is on and the table has **no policy**. No signed-in user and no anon key can
  read or write it, and only the route's service-role key can. The table comment `arc-launch webhooks` is the
  ownership marker. A table of that name without it refuses `TABLES_FOREIGN`. `body` keeps the raw delivery on the
  venture, and arc never reads it: verify selects only the payment columns.
- **Files committed** with this slot's trailer:
  - `app/api/webhooks/razorpay/route.js`: `POST` reads the body once as text. It computes HMAC-SHA256 hex of those raw
    bytes with `RAZORPAY_WEBHOOK_SECRET` and compares with `timingSafeEqual` after a length check. A missing secret
    answers 500, a bad signature 401, and a missing or malformed `x-razorpay-event-id` 400. Then it upserts one row
    through PostgREST with the service-role key, `on_conflict=event_id` and `resolution=ignore-duplicates`, so a
    redelivery stores nothing new. It answers 200 `{ stored: true|false }`. The route imports only `node:crypto` and
    calls `fetch`, so the contract suite runs the committed bytes themselves.
  - `.env.example` (shared, ADR-1729): `RAZORPAY_WEBHOOK_SECRET=` and `SUPABASE_SERVICE_ROLE_KEY=`, names only.
- **verify** asks the live route and the database, never state:
  1. The route file is launch's at main's head. The table carries the marker, RLS is on, and it has zero policies.
  2. It sends one signed probe event (`payment.captured`, ₹1 INR, fee 0) with an id and payment id derived from the
     slot's tag (`arcprobe…`, `pay_ArcProbe0…`), **twice**, the raw body byte for byte. Both must answer 200.
  3. Under its own event id, the same raw body is sent with a signature computed over a re-serialised copy of the JSON.
     It must answer 401. The correctly signed body with no event id must answer 400.
  4. The database must hold exactly one row for the probe payment id, under the probe event id, with amount 100, INR and
     `payment.captured`.

  Only then does it queue `revenue.simulated` with the stored row's payment columns. The evidence is `{ stored: 1,
  replays: 2, reserialised: 401, no_event_id: 400 }`. A verify run alone (`arc launch verify`) queues nothing that
  reaches the spine. Only an apply attempt's queue is booked.
- **What lands in the ledger, and how** (`simulated.mjs`, run by the runner from the clone that owns the spine): the
  stored payment becomes a one-row export in the razorpay parser's pinned header. `gross` is the amount, `fee` is
  Razorpay's fee (its GST is inside it), `tax` is 0 because a gateway collects no sales tax on the order, and
  `settlement_id` is the literal `simulated`, because a test payment never settles. `settled_at` is `paid_at` in IST.
  `parseRazorpayExport` and then `normalizeRow` (`interval: one_time`) build the payload, so the ledger's own
  invariants run on it. Before anything is written, the spine is scanned. A `revenue.simulated` with the same
  `provider_payment_id` for this venture is "recorded before" and adds nothing; the same id under another venture
  refuses. A torn or unreadable day refuses, because it is never read as absent. The write is `arc-event ingest
  revenue.simulated --strict --venture <slug> --process launch@0.1.0`, whose content idem is the second lock. A
  `DUP_IDEM` refusal is read as recorded before. Any other refusal or an unknown outcome fails the attempt with the
  reason `ledger:<why>`, and the attempt's `run.completed` (`honesty_class: rehearsal` on `arc-sandbox`) records it.
  The slot is verified only when the ledger line exists.
- **teardown:** drop `razorpay_webhook_events` if it still carries the `arc-launch webhooks` marker (down migration). The
  route and `.env.example` lines stay with the venture. The ledger line stays: the spine is append-only, and a simulated
  line nets to zero only through `refunds`.

## Consequences

- `arc pnl --simulated` shows one `SIMULATED` line of ₹1.00 per venture for the probe payment, and the real P&L is
  unchanged. A replay, a second verify, or a re-apply after a failed attempt adds no event.
- The owner places `RAZORPAY_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in the venture's production env. They add
  the dashboard webhook (same secret) once `dns` and `release` have run (phase-02 spec, "Your-setup").
- Deferred (debt D33): a real stored payment is not yet confirmed against `GET /v1/payments/<id>`, and a paid order
  does not yet set the org's plan in `org_plans` (ADR-1737's consequence). Both need `checkout-portal`'s order notes
  (org id, tag) and a real purchase, so they land with `checkout-portal` and `refunds`.
- `ctx.emit` widening is one kind, and it is booked only through the ledger's parser and validator, never as written.
  A forged queue entry can at most add a line labelled simulated, which the real P&L never reads.
