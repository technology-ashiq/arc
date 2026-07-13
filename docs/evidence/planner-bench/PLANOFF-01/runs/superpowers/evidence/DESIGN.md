# snip — DESIGN

A URL shortener. Node 22, ESM, `node:http`, `node:sqlite` (file-backed at `./data/snip.db`).

## 1. Requirements, interrogated

### R1 — Magic-link sign-in; a user only sees their own links
- Identity = the email address. No password, no user table beyond what we need.
- Non-obvious: **tests must not touch a live email provider.** So the mailer is an *interface*
  (`send(to, link)`), with a real impl (SMTP/HTTP provider, dev = console) and a fake
  (in-memory outbox). In `APP_ENV=test` we install the fake, and additionally the
  auth shim below means the tests never even need the magic-link round trip.
- Non-obvious: the **test shim is a security hole if it leaks into prod.** So `X-Test-USER`
  is read *only* when `process.env.APP_ENV === 'test'`, decided once at boot in a single
  `authenticate()` function. In any other env the header is not read at all — a request with
  it is exactly as unauthenticated as one without.
- Magic link itself: POST `/api/auth/magic-link {email}` → mint a 32-byte random token,
  store hash + expiry (15 min, single-use) in `auth_tokens`, mailer.send(). Always `202`
  even for an unknown email (no user enumeration).
  GET `/api/auth/callback?token=…` → consume token, set `snip_session` cookie =
  `base64(email).timestamp.hmac_sha256(SESSION_SECRET)`. Signed, so no session table.
  Expired/replayed token → `400`.
- Unauthenticated call to any `/api/links*` → **401**.

### R2 — Links survive a restart
- SQLite file, WAL. Nothing important lives only in memory. Schema created at boot
  (`CREATE TABLE IF NOT EXISTS`) so a fresh checkout just runs.

### R3 — Auto codes; optional custom alias; codes/aliases never collide
- One namespace, one column: `links.code` with a `UNIQUE` index. An alias *is* a code.
  This is the only way "two links can never share a code or alias" can be enforced
  by the database rather than by a hopeful `SELECT` (which races).
- Auto code: 7 chars of base62 from `crypto.randomBytes`. On `UNIQUE` violation, retry
  (5 attempts, then 500). Race-safe because the DB, not the check, decides.
- Alias validation: `^[A-Za-z0-9_-]{3,32}$` → else **400**. Reserved words (`api`, `health`,
  `favicon.ico`, `robots.txt`) are refused with **400** — they can't be reached anyway,
  so accepting them would be a lie.
- Alias already taken (**including by a soft-deleted link**) → **409**. Non-obvious:
  we do *not* free the code of a deleted link. Reusing it would mean an old QR code
  silently pointing at a stranger's URL. Gone means gone.

### R4 — Expiry
- `expires_at` stored as epoch ms, nullable. Must parse as ISO-8601 and be in the future
  → else **400** (a link that is born expired is a bug, not a feature).
- Expired link on `GET /:code` → **410 Gone**, no redirect, hit NOT counted.

### R5 — Delete ≠ never existed
- Soft delete: `deleted_at` timestamp. Row stays, code stays taken.
- `GET /:code` truth table — this is the heart of the exercise:
  | state | status |
  |---|---|
  | never existed | **404 Not Found** |
  | deleted | **410 Gone** |
  | expired | **410 Gone** |
  | alive | **302** + `Location`, hits += 1 |
- `DELETE /api/links/:code` → **204**; second delete → **404**? No: the *resource* is gone →
  **404** would say "never existed". We return **404** only for codes that were never the
  caller's; for an already-deleted own link we return **410**. Idempotency is preserved in
  the sense that the link stays deleted.
- Another user's code on DELETE → **404**. Not 403: revealing "this code exists but isn't
  yours" leaks the namespace. Ownership scoping is in the WHERE clause.

### R6 — Rate limit: 10 creates / minute / IP
- Sliding window of timestamps per IP, in memory (single process; a Redis-backed impl would
  swap in behind the same `RateLimiter` interface). 11th create in 60 s → **429**, with both
  `Retry-After: <seconds>` header and `{"error":"rate_limited","retryAfterSeconds":n}` body,
  where n = ceil((oldest_hit + 60s − now)/1000), min 1. "Tell them how long to wait" means
  a number, not a vibe.
- Client IP = socket address (`x-forwarded-for` only trusted when `TRUST_PROXY=1`, else it's
  a spoofable free pass around the limit).
- Only POST /api/links is limited. Redirects are not — that's the product.

### R7 — Tests are offline
- Every test binds `127.0.0.1:0` in-process. Mailer is the fake. No fetch to anything but
  our own ephemeral port. `npm test` = `node --test`, zero network.

## 2. Errors (the true status, not the convenient one)
400 malformed url/alias/expiry · 401 not signed in · 404 unknown code · 405 wrong method ·
409 code taken · 410 deleted or expired · 429 rate limited · 500 nothing we can salvage.

## 3. Shape
`server.mjs` (boot) → `lib/app.mjs` (routes) → `lib/store.mjs` (SQL) → `lib/db.mjs` (schema)
`lib/auth.mjs` (session + shim) · `lib/mailer.mjs` (real/fake) · `lib/ratelimit.mjs`
`POST /api/test/reset` exists only when `APP_ENV=test`; otherwise it 404s like any other path.
