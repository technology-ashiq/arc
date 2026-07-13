# snip — PLAN

Each task is 2–5 min. TDD: the test in step *a* must be written and seen to FAIL before step *b*.

## T0 — scaffold (no production logic)
- `package.json`: `"type":"module"`, `"test":"node --test --test-concurrency=1 test/"`.
- `test/harness.mjs`: `startApp()` → creates a temp db path under `os.tmpdir()`,
  `createApp({dbPath, appEnv:'test'})`, listens on `127.0.0.1:0`, returns
  `{base, close, restart}`. `restart()` closes the http server, reopens the app on the SAME
  db file → proves persistence. Helpers: `req(method, path, {user, body})`.

## T1 — auth + create + list  (`test/links.test.mjs`)
a. Tests: POST /api/links without `X-Test-User` → 401. With user → 201 `{code, shortUrl}`,
   shortUrl ends with `/`+code. GET /api/links returns only the caller's links
   (create as a@x, create as b@x, each sees exactly 1). Bad url (`not-a-url`, `ftp://x`) → 400.
b. Impl: `lib/db.mjs` (schema), `lib/store.mjs` (createLink/listLinks), `lib/auth.mjs`
   (shim + cookie session), `lib/app.mjs` (router: POST/GET /api/links), `server.mjs`.
c. Run → green. Commit `feat: create and list links, auth shim`.

## T2 — redirect, hits, alias, expiry  (`test/redirect.test.mjs`)
a. Tests: GET /:code → 302 + Location = long url; after 2 hits, GET /api/links shows hits=2.
   Unknown code → 404. Custom alias honoured (code === alias). Duplicate alias → 409.
   Alias colliding with an auto code → 409. Bad alias `no spaces!` → 400. Reserved `api` → 400.
   `expiresAt` in the past → 400. Link with expiry 50 ms out: redirects now, 410 after it passes,
   and the expired hit is NOT counted.
b. Impl: `getByCode`, `bumpHit`, alias validation, expiry parsing, `GET /:code` truth table.
c. Run → green. Commit `feat: redirects, hit counting, aliases, expiry`.

## T3 — delete = gone  (`test/delete.test.mjs`)
a. Tests: DELETE own link → 204; GET /:code → **410** with body `{"error":"gone"}` (NOT 404);
   deleted link absent from GET /api/links; DELETE someone else's code → 404 and their link
   still redirects; DELETE a never-existent code → 404; re-DELETE own deleted code → 410;
   the deleted code cannot be re-claimed as an alias → 409.
b. Impl: soft delete (`deleted_at`), ownership WHERE clause, 410 branch.
c. Run → green. Commit `feat: soft delete returns 410 gone`.

## T4 — rate limit  (`test/ratelimit.test.mjs`)
a. Tests: 10 creates OK; 11th → 429, `Retry-After` header is an integer 1..60, body has
   `retryAfterSeconds` ≥ 1. A different IP is unaffected → skipped (single loopback IP);
   instead: POST /api/test/reset → 204 → the 11th create now succeeds (proves reset wipes
   rate-limit state AND links). Rate limit is per-IP not per-user: user b@x is also blocked
   on the same IP.
b. Impl: `lib/ratelimit.mjs` sliding window; `POST /api/test/reset` (test env only).
c. Run → green. Commit `feat: 10/min/IP rate limit with Retry-After`.

## T5 — prod shim is off + persistence  (`test/security.test.mjs`)
a. Tests: app booted with `appEnv:'production'` → `X-Test-User` header is ignored → 401;
   `POST /api/test/reset` → 404 in production. Magic link: POST /api/auth/magic-link → 202,
   fake outbox got exactly 1 message, callback token → session cookie → cookie authenticates
   GET /api/links (200). Reused token → 400. Persistence: create link, `restart()`, the link
   still redirects and hits survive.
b. Impl: `lib/mailer.mjs` (fake outbox + console real), magic-link routes, cookie auth.
c. Run → green. Commit `feat: magic-link sign-in, prod ignores test header`.

## T6 — ship
- `README.md`: one-command start (`PORT=3105 APP_ENV=test node server.mjs`), dev start,
  API table, env vars.
- Boot the real server on 3105 exactly as specified, curl a full create→redirect→410 cycle,
  paste output. Full `npm test` run pasted. `run-meta.json`. Commit `docs: readme` / `chore: run meta`.
