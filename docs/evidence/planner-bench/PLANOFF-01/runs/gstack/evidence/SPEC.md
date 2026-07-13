# SPEC — snip (URL shortener)

## Executable definition of done
- `PORT=3104 APP_ENV=test node server.mjs` starts the app; it listens on `process.env.PORT`.
- `npm test` is green with **no network access** (no third-party call anywhere in the test path).
- `README.md` gives the one-command start.

## In scope
1. **Auth** — email magic link (real path in dev/prod). In `APP_ENV=test` only, header `X-Test-User: <email>` authenticates. Outside test, that header is ignored *completely*.
2. **Create link** — `POST /api/links` `{url, alias?, expiresAt?}` → `201 {code, shortUrl}`.
3. **List own links** — `GET /api/links` → `200 [{code,url,hits,expiresAt}]`, caller's links only.
4. **Delete** — `DELETE /api/links/:code` → `204`.
5. **Redirect** — `GET /:code` → `302` to the long URL, hit counted.
6. **Reset** — `POST /api/test/reset` → `204`, test mode only, wipes links + rate-limit state.
7. **Persistence** — SQLite (`node:sqlite`, `./data/snip.db`); links survive restart.
8. **Uniqueness** — no two links ever share a code/alias (incl. against deleted codes).
9. **Expiry** — expired link stops redirecting.
10. **Rate limit** — 10 creates/min/IP; over the limit the caller is told *how long to wait*.

## Status-code contract (the code that is TRUE, not the one that is convenient)
| Situation | Status |
|---|---|
| create ok | 201 |
| bad/`javascript:` url, bad alias, expiry in the past, malformed JSON | 400 |
| no session / not signed in | 401 |
| alias (or dead alias) already taken | 409 |
| create over rate limit | 429 + `Retry-After` header + `retryAfterSeconds` |
| redirect to a live link | 302 |
| code never existed | **404 not found** |
| code existed and was **deleted** | **410 Gone** ("this link was deleted") |
| code **expired** | **410 Gone** ("this link expired") |
| DELETE someone else's code, or an unknown code | 404 (no existence disclosure) |
| DELETE own code twice | 204 (idempotent) |
| `/api/test/reset` when not test mode | 404 (endpoint does not exist) |

410-vs-404 is requirement 5: a deleted code is *gone*, not *unknown*. A deleted code is never re-issued.

## Out of scope (deliberately)
Password auth, teams/sharing, analytics beyond a hit counter, link editing, QR codes, custom domains, click-level logs, an SPA. The dashboard is one static HTML page against the API.
