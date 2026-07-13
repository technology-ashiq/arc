# snip

A URL shortener: sign in with an email magic link, shorten a URL (auto code or your own
alias, optional expiry), share it, watch the hits, delete it when you're done.

Node 22 · ESM · `node:http` · `node:sqlite` (file-backed at `./data/snip.db`) · zero dependencies.

## Start it

```bash
PORT=3105 APP_ENV=test node server.mjs
```

That is the whole command - no install step, no database to provision. The SQLite file is
created on first boot and the links in it survive restarts.

For dev / production:

```bash
PORT=3105 node server.mjs                                  # dev: magic links print to the console
SESSION_SECRET=... APP_ENV=production node server.mjs      # prod: real email, no test shim
```

## Tests

```bash
npm test     # node --test - 26 tests, no network access at all
```

The email provider is an interface with an in-memory fake, so nothing in the test path ever
calls a live third party.

## API

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/links` | `{ "url", "alias"?, "expiresAt"? }` -> `201 { "code", "shortUrl" }` |
| GET | `/api/links` | `200 [{ "code", "url", "hits", "expiresAt" }]` - your links only |
| DELETE | `/api/links/:code` | `204` |
| GET | `/:code` | `302` to the long URL; the hit is counted |
| POST | `/api/auth/magic-link` | `{ "email" }` -> `202`, emails a sign-in link |
| GET | `/api/auth/callback?token=` | `302` + session cookie |
| POST | `/api/test/reset` | `APP_ENV=test` only -> `204`, wipes links + rate-limit state |

### Status codes mean what they say

| situation | status |
|---|---|
| code never existed | `404 not_found` |
| link was deleted | `410 gone` - the code is gone, not unknown |
| link has expired | `410 expired` (the visit is not counted) |
| alias/code already taken (even by a deleted link) | `409 code_taken` |
| bad url / alias / expiry | `400` |
| not signed in | `401` |
| more than 10 creates a minute from one IP | `429` + `Retry-After: <seconds>` and `{"retryAfterSeconds": n}` |

## Environments

`APP_ENV=test` - and only `APP_ENV=test` - honours the `X-Test-User: <email>` header as a
signed-in user and exposes `POST /api/test/reset`. In any other environment that header is
ignored completely and the reset route 404s; magic-link sign-in is the real path.

```bash
curl -X POST localhost:3105/api/links \
  -H 'content-type: application/json' -H 'X-Test-User: me@example.com' \
  -d '{"url":"https://example.com/a-very-long-url","alias":"demo1"}'
curl -i localhost:3105/demo1     # 302 -> https://example.com/a-very-long-url
```

## Environment variables

| var | default | meaning |
|---|---|---|
| `PORT` | `3105` | listen port |
| `APP_ENV` | `development` | `test` / `development` / `production` |
| `DB_PATH` | `./data/snip.db` | SQLite file |
| `SESSION_SECRET` | random per boot (required in production) | signs the session cookie |
| `BASE_URL` | request host | origin used to build `shortUrl` |
| `TRUST_PROXY` | `0` | `1` to believe `X-Forwarded-For` for rate-limit IPs |

## Design

`DESIGN.md` - why each decision is what it is. `PLAN.md` - how it was built, test-first.
