# snip

A URL shortener. Sign in with an email magic link, shorten a URL (auto code or your
own alias, with an optional expiry), share it, and watch the hits add up.

## Start it (one command)

```bash
PORT=3101 APP_ENV=test node server.mjs
```

Requires **Node 22+** (it uses the built-in `node:sqlite`). No `npm install` — snip
has zero runtime dependencies. The database is created at `./data/snip.db` on first
boot and your links survive a restart.

For a real dev server with magic-link sign-in (no test shim):

```bash
PORT=3101 APP_ENV=dev node server.mjs   # the sign-in link is printed to the console
```

## Tests

```bash
npm test
```

33 tests, no network: the email provider sits behind an `EmailSender` port whose
fake records mail in memory. `APP_ENV=test` **refuses to boot** with a network email
driver, so a test can't reach a live provider even by accident.

## Auth

- **Real path (all envs):** `POST /api/auth/magic-link {email}` → an email with a
  single-use link (15 min) → `GET /api/auth/callback?token=…` → session cookie.
- **Test shim (`APP_ENV=test` only):** send `X-Test-User: you@example.com` and you
  are that user, with no email sent. Under any other `APP_ENV` this header is
  **ignored completely** and `/api/test/reset` does not exist.

## API

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/api/links` | `{url, alias?, expiresAt?}` → `201 {code, shortUrl}` |
| `GET` | `/api/links` | `200 [{code, url, hits, expiresAt}]` — your own links only |
| `DELETE` | `/api/links/:code` | `204` |
| `GET` | `/:code` | `302` to the long URL, and counts the hit |
| `POST` | `/api/test/reset` | test mode only → `204`, wipes links + rate-limit state |

```bash
curl -X POST localhost:3101/api/links \
  -H 'x-test-user: ana@example.com' -H 'content-type: application/json' \
  -d '{"url":"https://example.com/a/very/long/path","alias":"docs"}'
# {"code":"docs","shortUrl":"http://localhost:3101/docs"}
```

## Status codes — the true one, not the convenient one

| Situation | Code |
|---|---|
| Created / deleted / redirected | `201` / `204` / `302` |
| Bad url, bad alias, expiry in the past | `400` |
| Not signed in | `401` |
| Alias already taken | `409` |
| Code never existed, or isn't yours | `404` |
| **Code existed and was deleted** | **`410 Gone`** |
| **Code existed and expired** | **`410 Gone`** |
| Over 10 creates/min from your IP | `429` + `Retry-After` |

A **deleted link is `410 Gone`, not `404`** — the code is *gone*, not *unknown*. The
row is soft-deleted, so a deleted or expired code can never be handed out again.

## Rate limiting

Creating is limited to **10 per minute per IP** (sliding window). Over the limit you
get `429` with a `Retry-After` header *and* `retryAfterSeconds` in the body — the
real number of seconds until a retry will actually succeed. Following a link is
never limited. `X-Forwarded-For` is only trusted when `TRUST_PROXY=1`; otherwise the
limit would be bypassable by forging a header.

## Configuration

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3101` | |
| `APP_ENV` | `dev` | `test` enables the shim + reset route; `prod` hardens cookies |
| `DB_FILE` | `./data/snip.db` | |
| `BASE_URL` | request host | the origin used to build `shortUrl` |
| `TRUST_PROXY` | off | set `1` only when actually behind a proxy |
| `EMAIL_DRIVER` | `console` (`http` in prod) | `console` = fake sender, in-memory |
| `EMAIL_API_URL` / `EMAIL_API_KEY` / `EMAIL_FROM` | — | required for `http` |

## Layout

```
server.mjs        process wiring: real clock, crypto ids, configured email sender
src/config.mjs    boot-time config; the test shim's blast radius is decided here
src/app.mjs       routes
src/auth.mjs      magic link, sessions, and the one place the shim is read
src/links.mjs     codes, aliases, expiry, redirect, soft delete
src/ratelimit.mjs sliding-window limiter
src/ports.mjs     Clock / IdGenerator / EmailSender — fake + real for each
src/db.mjs        sqlite schema
```

`PLAN.md` has the pre-mortem and the phase order; `PROGRESS.md` has the state.
