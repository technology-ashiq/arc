# ADR 1738 — checkout-portal creates the order on the server, and verify reads it back without paying

**Status:** accepted
**Date:** 2026-10-07
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture that sells more than one paid plan or a non-INR price, or Razorpay Subscriptions in place
of one-off orders

## Context

The `checkout-portal` slot's exit criterion is "portal probe (test mode)". It depends on `plans` (ADR-1737: org plans,
the `pro` feature list) and `payment-test` (ADR-1736: test keys proven). A Razorpay checkout needs an order created on
the server with the secret key. The browser then opens Checkout with the order id and the key id, which is public.
Completing a payment takes a human, or a browser, entering a test card. No probe can do that without card details,
and webhooks-ledger (the next slice) proves the paid path from Razorpay's own event. The `razorpay-checkout` row was
written at kickoff with only `api.razorpay.com`.

## Options considered

1. **verify completes a test payment** — it would need a scripted browser, card entry and 3-D Secure, from a slot
   runner that has no browser.
2. **verify proves the portal up to the payment** — a signed-in member asks the live app for a checkout. The app
   creates a Razorpay order on the server, and Razorpay confirms that order exists, for the right org and amount, in
   test mode. The paid path is then proven by `webhooks-ledger` from the event Razorpay sends.

## Decision

Option 2.

- **Row:** `razorpay-checkout` gains `sandbox.automemory.ai`, `api.supabase.com`, `supabase.co` and `api.github.com`
  in `hosts[]`, and `SUPABASE_ACCESS_TOKEN` and `GITHUB_TOKEN` beside the two Razorpay keys.
- **Files**, with this slot's trailer:
  - `lib/prices.js` — `pro` costs 49900 paise in INR (₹499), and is the only paid plan.
  - `app/api/checkout/route.js` — `POST {org}` answers 401 when signed out, 400 for an id that is not a uuid, and 403
    when the caller is not a member. Otherwise it creates an order with Basic auth from the server's env: amount and
    currency from `lib/prices.js`, receipt `org-<first 24 of the org id>`, notes `{ org_id, plan: "pro" }`. It
    answers 201 `{ order_id, key_id, amount, currency }`. The secret never leaves the server, and a `rzp_live_` key
    id in the server's env answers 503: the portal never sells live from a launch-built route (gate 3, ADR-1720).
  - `app/checkout/page.js` — a page that loads `https://checkout.razorpay.com/v1/checkout.js` and opens it from the
    route's answer.
- **`.env.example`** gains `RAZORPAY_KEY_ID=` and `RAZORPAY_KEY_SECRET=` as shared lines (ADR-1729), so `secrets`
  names them for the owner to place in Vercel. launch never puts the values there (ADR-1713).
- **verify** asks the live app and Razorpay:
  1. The checkout page answers 200, and its body names `checkout.razorpay.com/v1/checkout.js`.
  2. Probe user A, a member of `launch-probe-a`, POSTs `/api/checkout` and gets 201. The key id it is given is
     `rzp_test_` and equals this slot's own `RAZORPAY_KEY_ID`, so the site runs the keys launch proved.
  3. `GET /v1/orders/<order_id>` with this slot's keys answers the order with amount 49900, INR, and
     `notes.org_id` equal to the probe org.

  The evidence is `{ page: 200, checkout: 201, order: <id>, amount: 49900 }`. A probe order is created on every
  verify. In test mode it moves no money and is labelled by its notes.
- **teardown:** none. The committed files stay with the venture, Razorpay keeps orders, and the `.env.example` lines
  are shared.

## Consequences

- REQ-04's checkout step is proven as far as payment entry. The payment itself is proven by `webhooks-ledger`.
- The venture has one paid plan at one price, changed by editing `lib/prices.js` (a launch-owned file, so verify
  names the drift).
- Each verify adds one INR 499 test order to the owner's Razorpay test dashboard.
