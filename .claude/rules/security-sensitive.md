---
description: Extra rigor for security-sensitive code (auth, payments, API surface, data access). Triggers a deep /arc-audit before ship.
paths:
  - "**/auth/**"
  - "**/api/**"
  - "**/payments/**"
  - "**/*stripe*"
  - "supabase/**"
  - "**/middleware.ts"
---

You are in security-sensitive code. Non-negotiable:

- Never trust client input for authorization decisions or money amounts -- verify server-side.
- Supabase: RLS on by default; service-role key is server-only; never expose it via `NEXT_PUBLIC_`.
- Stripe: verify webhook signatures; reconcile amounts server-side; never trust client-sent totals.
- Secrets only from `.env.local`; never log them; never let them reach the client bundle.
- Run **/arc-audit** on this diff before shipping and add `security` to `ARC_REQUIRED_REVIEWS`. A CRITICAL finding blocks ship until fixed via `/arc-fix-issue`.
