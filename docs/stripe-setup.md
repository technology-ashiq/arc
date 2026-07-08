# Stripe Setup

## Products & prices
- Define products in the dashboard. Record price IDs here:
  - Pro (one-time): `price_TODO`
- Map price -> entitlement in `lib/entitlements.ts`.

## Checkout
- Create a Checkout Session server-side, then redirect. Success/cancel URLs come from env.

## Webhooks
- Endpoint: `/api/webhooks/stripe`. Verify with `STRIPE_WEBHOOK_SECRET`.
- Handle `checkout.session.completed` (+ `customer.subscription.*` if you add subscriptions).
- Idempotent: store processed event IDs.

## Local testing
- `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Env
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
