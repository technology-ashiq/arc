---
description: Stripe payment rules — Checkout, webhooks, entitlements.
paths:
  - "lib/stripe/**"
  - "lib/entitlements.ts"
  - "app/api/webhooks/stripe/**"
---

# Stripe Rules

- Use Stripe Checkout / Billing Portal — don't hand-roll card collection (keeps PCI scope small).
- The webhook handler is the single source of truth for entitlements; verify its signature.
- Test-mode keys in dev, live keys only in production env. Never mix.
- Map `price_id` -> entitlement in `lib/entitlements.ts`. One place only.
- Webhook handlers must be idempotent (Stripe retries).
- Full setup + product/price IDs -> ../../docs/stripe-setup.md
