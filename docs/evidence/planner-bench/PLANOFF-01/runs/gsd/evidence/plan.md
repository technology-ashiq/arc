# PLAN — snip

Derived from the LOCKED SPEC.md. Decision numbers (D1..D18) refer to SPEC §3.

## Files
- `server.mjs` — entrypoint only: reads env, builds deps (db, mailer), calls `createServer`, listens on `process.env.PORT`.
- `src/db.mjs` — `openDb(file)`: DatabaseSync, pragmas, idempotent schema (D16).
- `src/mailer.mjs` — `ConsoleMailer` / `SmtpMailer` + `pickMailer(env)` (D14).
- `src/ratelimit.mjs` — sliding-window limiter, `check(ip)` → `{ok}` | `{ok:false, retryAfterSeconds}` (D12/D13).
- `src/auth.mjs` — magic-link issue/consume, session cookie, `identify(req)` with the test shim gated on `APP_ENV==='test'` (D2/D14/D15).
- `src/links.mjs` — validation + create/list/delete/resolve (D1,D3–D11).
- `src/app.mjs` — `createApp({db, env, mailer, port, baseUrl})` → node:http request handler + router.
- `src/html.mjs` — tiny dashboard/login pages (no framework).
- `test/*.test.mjs` — node:test.
- `README.md`, `STATE.md`, `run-meta.json`, `package.json` (`"type":"module"`, `test: node --test`).

## Schema (D5, D16)
```sql
users(id INTEGER PK, email TEXT UNIQUE NOT NULL, created_at INTEGER)
sessions(token_hash TEXT PK, user_id INT REFS users, expires_at INTEGER)
magic_tokens(token_hash TEXT PK, email TEXT, expires_at INTEGER, used INTEGER DEFAULT 0)
links(id INTEGER PK, code TEXT NOT NULL UNIQUE, url TEXT NOT NULL, user_id INT REFS users,
      hits INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NULL,
      created_at INTEGER NOT NULL, deleted_at INTEGER NULL)
```
`code` is UNIQUE across live AND soft-deleted rows ⇒ codes are never recycled (D5) and "gone" is
distinguishable from "unknown" (D10).

## Waves
1. **W1 core**: package.json, db, schema, mailer, ratelimit, auth, links, app, server.mjs. Commit.
2. **W2 tests**: full suite covering D1–D18. Commit.
3. **W3 verify**: `npm test`, live boot on 3103 + curl walk of the SPEC table, README, STATE.md. Commit.

## Request flow
`POST /api/links` → limiter (D12, before auth so an unauthenticated flood is also capped? NO —
see plan-check PC-5) → identify (401 D2) → validate url (D1) / alias (D4/D6) / expiry (D7) →
insert with retry on UNIQUE (D3) → 201.
`GET /:code` → lookup by code → not found ⇒ 404 (D10); deleted_at ⇒ 410 (D10); expired ⇒ 410 (D7);
else `UPDATE links SET hits=hits+1` then 302 (D9).

---

# PLAN-CHECK (self-review of the plan against the SPEC)

Re-read the SPEC line by line; every gap found is listed and then fixed in the plan above/below.

- **PC-1 — D8 not covered:** the plan's list query said "own links"; it must also *exclude deleted*
  but *include expired*. → FIX: `SELECT ... WHERE user_id=? AND deleted_at IS NULL ORDER BY id DESC`.
- **PC-2 — D11 not covered:** delete of another user's code must be 404, of own already-deleted code
  410, of unknown 404. → FIX: delete resolves the code globally first, then branches:
  unknown⇒404, deleted⇒410, owner≠caller⇒404, else soft-delete⇒204.
- **PC-3 — D6 partial:** the alias-taken check must also see soft-deleted rows. The UNIQUE index
  gives this for free, but the pre-check query must not filter on `deleted_at IS NULL`, and the
  handler must map a UNIQUE violation on a user-supplied alias to 409 (not 500). → FIX: catch the
  constraint error and branch on whether an alias was supplied.
- **PC-4 — D12 "rejected requests don't consume quota" not covered:** the naive limiter pushes a
  timestamp on every call. → FIX: only push when the request is allowed.
- **PC-5 — ordering bug:** if the limiter ran before auth, an anonymous flood would burn a real
  user's IP quota and a 401 would consume quota. SPEC says the limit is on *creating links*.
  → FIX: order = parse body → identify (401) → limiter (429) → validate → insert. So 401s never
  consume quota, but invalid bodies from an authed caller do (they reached the create handler).
- **PC-6 — D15 not covered by any test:** need an explicit test booting an app with
  `APP_ENV=production` and asserting `X-Test-User` yields 401.
- **PC-7 — D17 not covered:** need a test that `/api/test/reset` is 404 when not in test mode, and
  that after a reset the rate-limit window is clear (otherwise the rate-limit test poisons others).
- **PC-8 — D14 not covered:** magic-link flow needs a test that exercises issue→consume→session
  →create-link with the ConsoleMailer, proving the real auth path works with zero network.
- **PC-9 — D5 not covered:** need a test that a deleted link's code cannot be re-taken as an alias.
- **PC-10 — restart durability (S5/D16) not covered:** need a test that closes the db/app, reopens
  the same file, and still finds the link + its hits.
- **PC-11 — `expiresAt` output shape unstated:** stored as epoch-ms, but the contract shows
  `expiresAt` in a JSON list. → FIX: serialise back as ISO-8601 string, or `null`.
- **PC-12 — hits must survive concurrent redirects:** use a single SQL `UPDATE ... hits = hits + 1`
  (atomic), never read-modify-write in JS.
- **PC-13 — body parsing:** malformed JSON must be `400 invalid_json`, not a 500 crash. Cap body at
  64KB.
- **PC-14 — test isolation:** each test file gets its own temp DB file and an ephemeral port
  (`listen(0)`), so `npm test` needs no fixed port and no network.

All 14 gaps are now folded into the waves above. Plan is complete → EXECUTE.
