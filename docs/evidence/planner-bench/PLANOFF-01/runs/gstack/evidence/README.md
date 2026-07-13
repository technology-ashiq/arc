# snip

A URL shortener. Sign in with an email magic link, shorten a URL (optionally with a
custom alias and an expiry), share the short link, watch the hits climb, delete it when
you are done.

Node 22, zero runtime dependencies, SQLite via the built-in `node:sqlite`.

## Start it (one command)

```bash
PORT=3104 APP_ENV=test node server.mjs
```

Then open <http://localhost:3104>. In `APP_ENV=test` any request can authenticate with a
header instead of an email round-trip:

```bash
curl -X POST localhost:3104/api/links \
  -H 'X-Test-User: alice@example.com' -H 'content-type: application/json' \
  -d '{"url":"https://example.com/something/long","alias":"hello"}'
# {"code":"hello","shortUrl":"http://localhost:3104/hello"}

curl -i localhost:3104/hello     # 302 -> https://example.com/something/long
```

For the real magic-link flow run it as dev (`APP_ENV=dev node server.mjs`): the sign-in
link is printed to the console instead of emailed.

## Tests

```bash
npm test     # 23 tests, no network access required
```

The email provider sits behind an interface with an in-memory fake
(`MAIL_TRANSPORT=memory`), so nothing in the test path talks to a third party.

## API

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/links` | `{url, alias?, expiresAt?}` → `201 {code, shortUrl}` |
| GET | `/api/links` | `200 [{code, url, hits, expiresAt}]` — your links only |
| DELETE | `/api/links/:code` | `204` (idempotent) |
| GET | `/:code` | `302` to the long URL; the hit is counted |
| POST | `/api/auth/request` | `{email}` → `202`, sends a magic link |
| GET | `/api/auth/callback?token=` | `302` + session cookie |
| POST | `/api/test/reset` | `204` — **test mode only**, otherwise 404 |

### The status codes mean what they say
- **404** — that code never existed.
- **410** — that code existed and is **gone**: `link_deleted` (the owner deleted it) or
  `link_expired`. A deleted code is never re-issued, so a dead link can never quietly
  start pointing somewhere new.
- **409** — that alias is taken (including by a deleted link).
- **429** — you created 10 links in the last minute. The `Retry-After` header **and**
  `retryAfterSeconds` in the body tell you exactly how long to wait.
- **400** — bad URL (http/https only), bad alias, or an expiry in the past.

## Configuration

| Env | Default | Notes |
|---|---|---|
| `PORT` | `3104` | |
| `APP_ENV` | `dev` | `test` enables the `X-Test-User` shim and `/api/test/reset`. Anywhere else that header is ignored completely. |
| `DB_PATH` | `./data/snip.db` | |
| `BASE_URL` | request host | Used to build `shortUrl`. |
| `SESSION_SECRET` | ephemeral | **Required** when `APP_ENV=production` — the app refuses to boot without it. |
| `TRUST_PROXY` | off | Set to `1` only behind a proxy you control; otherwise `X-Forwarded-For` is ignored so it cannot be used to dodge the rate limit. |
| `MAIL_TRANSPORT` | `console` (`smtp` in prod) | `memory` \| `console` \| `smtp`. |

## Known limits
- The `smtp` transport is an interface, not a wired provider: it throws rather than
  pretending to send. A prod deploy must implement `send()` (`lib/mailer.mjs`).
- Rate limiting is in-memory and per-process: it resets on restart and does not span
  instances. Multi-instance deploys need a shared store.
- Auth is checked before the rate limiter, so a flood of *unauthenticated* create attempts
  is rejected (401) but not throttled. No link can be created that way.
- Deleted links are tombstoned forever (that is what keeps a code burned); the table only
  grows.
