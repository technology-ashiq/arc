# snip

A URL shortener. Sign in with an email magic link, shorten a URL, share it, watch the hits climb.

## Start it

```bash
PORT=3102 APP_ENV=test node server.mjs
```

Then open http://localhost:3102 . No install step, no build step - Node 22.5+ and nothing else.
(Normal dev run: `npm run dev`. Production: `APP_ENV=production PORT=8080 node server.mjs`.)

## Test it

```bash
npm test
```

Runs entirely offline: the suite talks to a loopback server and an in-memory `FakeMailer`.
Nothing in the test path contacts a third-party service.

## How it works

- **Storage** - SQLite (`node:sqlite`, no native modules) at `./data/snip.db`, override with `DB_PATH`. Links survive restarts.
- **Auth** - magic link. `POST /api/auth/magic-link` mails a single-use token; `GET /auth/callback?token=...` trades it for an HttpOnly session cookie. You only ever see your own links.
- **Test auth shim** - when `APP_ENV=test`, `X-Test-User: you@example.com` authenticates as that user and no mail is sent. Under any other `APP_ENV` the header is ignored completely, and `/api/test/reset` does not exist.
- **Codes** - 7 random chars, or your own `alias`. A code is unique forever: even a deleted one is never re-issued.
- **Expiry** - optional `expiresAt`; past that moment the link stops redirecting.
- **Rate limit** - 10 creates per minute per IP. Over the line you get `429` with a `Retry-After` header and `retryAfterSeconds` in the body.

## API

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/links` | `{ url, alias?, expiresAt? }` -> `201 { code, shortUrl }` |
| GET | `/api/links` | `200 [{ code, url, hits, expiresAt }]` - yours only |
| DELETE | `/api/links/:code` | `204` |
| GET | `/:code` | `302` to the long URL, hit counted |
| POST | `/api/auth/magic-link` | `{ email }` -> `202`, sign-in link mailed |
| GET | `/auth/callback?token=` | `302 /dashboard`, sets the session cookie |
| POST | `/api/test/reset` | test mode only -> `204`, wipes links + rate-limit state |

### Status codes, meant literally

| Code | When |
|---|---|
| `400` | the URL, alias, or expiry is malformed |
| `401` | not signed in |
| `404` | that code was never issued - or it is not yours, which we will not confirm |
| `409` | that alias is taken (including by a deleted link - the code is burned) |
| `410` | the link **existed and is gone**: deleted by its owner, or expired |
| `429` | over the rate limit - wait `Retry-After` seconds |

`404` vs `410` is the point: "never existed" and "you cannot have this anymore" are different answers.

## Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `APP_ENV` | `development` | `test` enables the auth shim + reset route |
| `DB_PATH` | `./data/snip.db` | |
| `BASE_URL` | request `Host` | used to build `shortUrl` |
| `TRUST_PROXY` | off | set `1` to read the client IP from `X-Forwarded-For` |
| `MAIL_API_KEY` / `MAIL_FROM` | - | required only when `APP_ENV=production` |
