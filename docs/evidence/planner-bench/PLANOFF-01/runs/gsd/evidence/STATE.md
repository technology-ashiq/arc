# STATE — snip

| phase | status |
|---|---|
| SPEC | done — `SPEC.md`, 18 ambiguities resolved as numbered decisions |
| PLAN | done — `PLAN.md`, plan-check found 14 uncovered requirements, all folded back in |
| EXECUTE | done — 2 waves (core, tests), committed |
| VERIFY | **passed** |
| SHIP | shipped |

## VERIFY record

1. `npm test` → **25/25 pass, 0 fail** (exit 0), no network used: the email provider is a fake
   (`ConsoleMailer`) and every request goes to 127.0.0.1 on an ephemeral port.
2. Live SPEC walk against the running app started with exactly
   `PORT=3103 APP_ENV=test node server.mjs` (`node scripts/smoke.mjs`) → **ALL CHECKS PASSED**:
   - POST /api/links with alias → 201 `{code:"demo", shortUrl:"http://localhost:3103/demo"}`
   - POST /api/links auto code + expiry → 201, 7-char code
   - GET /demo → 302 → https://example.com/long, hit counted (hits=1)
   - GET /api/links → own links only, with hits + ISO expiresAt
   - GET /nope → 404 not_found
   - DELETE /api/links/demo → 204; GET /demo → **410 gone** ("this link has been deleted") — gone, not unknown
   - a second user sees an empty list
   - the 11th create in a minute → 429, `Retry-After: 60`, `{"retryAfterSeconds":60}`
   - POST /api/test/reset → 204, and creating works again afterwards

## Known gaps (honest list)
- The rate limiter is in-process memory, so it is per-server-instance; a multi-process deployment
  would need a shared store. Fine for the single-process spec.
- `SmtpMailer` (the only code that can touch the network) is never constructed outside
  `APP_ENV=production` and is therefore not covered by an integration test — by design (D14).
- The dashboard UI is deliberately minimal (no build step, no framework).
