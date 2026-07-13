# snip — a URL shortener

Sign in with an email magic link, turn long URLs into short codes (or your own alias),
watch the hits, delete what you don't want. SQLite-backed, so links survive a restart.

## Start it (one command)

```bash
PORT=3103 APP_ENV=test node server.mjs
```

Then open http://localhost:3103. In `APP_ENV=test` any request carrying `X-Test-User: you@example.com`
is signed in as that user and no email is sent. Requires Node 22+ (uses the built-in `node:sqlite`);
there is nothing to `npm install`.

For dev/prod, drop the test env: `PORT=3103 APP_ENV=development node server.mjs` — sign-in then goes
through the real magic-link flow (the link is printed by the console mailer; set `MAIL_ENDPOINT` +
`MAIL_API_KEY` with `APP_ENV=production` to send it for real). **Outside test mode the `X-Test-User`
header is ignored completely.**

## Tests

```bash
npm test        # 25 tests, no network access — the email provider is a fake
```

## API

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/links` | `{url, alias?, expiresAt?}` → `201 {code, shortUrl}` |
| GET | `/api/links` | `200 [{code, url, hits, expiresAt}]` — your own links only |
| DELETE | `/api/links/:code` | `204` |
| GET | `/:code` | `302` to the long URL, hit counted |
| POST | `/api/test/reset` | `204` (test mode only) — wipes links + rate-limit state |
| POST | `/api/auth/magic-link` | `{email}` → `202` |
| GET | `/api/auth/callback?token=` | `302 /dashboard` + session cookie |

Status codes that are actually true: `401` unauthenticated · `400` invalid url/alias/expiry/json ·
`409` alias taken or reserved · `404` a code that never existed · **`410` a code that is gone**
(deleted or expired) · `429` rate limited, with `Retry-After` and `retryAfterSeconds`.

Creating links is capped at **10 per minute per IP** (sliding window). Rejected requests don't
consume quota.

## Layout
`server.mjs` (entrypoint) · `src/db.mjs` (schema) · `src/auth.mjs` (magic link, sessions, test shim) ·
`src/links.mjs` (create/list/delete/resolve) · `src/ratelimit.mjs` · `src/app.mjs` (router) ·
`SPEC.md` / `PLAN.md` / `STATE.md` (how this was built) · `scripts/smoke.mjs` (live SPEC walk).
