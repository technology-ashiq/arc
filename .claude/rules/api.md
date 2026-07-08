---
description: API route rules — security, validation, rate limiting, webhooks.
paths:
  - "src/api/**"
  - "app/api/**"
---

# API Route Rules

Path-scoped: Claude loads this only when touching `src/api/**` or `app/api/**`. Non-negotiable.

- **Rate limiting:** every public route is rate-limited (per IP + per user) via `lib/rate-limit.ts`.
- **Authorization:** check the session/JWT on every mutating route. Never trust a client-sent user id.
- **Validation:** validate input with zod at the edge; reject unknown fields.
- **Stripe webhooks:** verify the signature with the webhook secret before doing anything. Idempotent only.
- **Never log** request bodies, tokens, or PII. Redact before logging.
- **Errors:** return typed error shapes; never leak stack traces to the client.
- **Heavy work / exports:** stream or queue — don't block the request thread.
