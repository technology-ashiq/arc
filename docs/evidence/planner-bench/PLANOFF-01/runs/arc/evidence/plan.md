# snip — PLAN

A URL shortener. Signed-in users create short links; anyone following a code is
redirected and the hit is counted; owners see their own links and can delete them.

Stack (fixed by environment): Node 22, ESM, `node:http`, `node:sqlite`
(`DatabaseSync`), file-backed at `./data/snip.db`. No Postgres, no better-sqlite3.

---

## Pre-mortem — it is two weeks later and snip shipped broken. What went wrong?

Written BEFORE any code. Each item is a way *this exact spec* gets got wrong,
plus the decision I am making now to stop it.

1. **The test auth shim became a production auth bypass.**
   `X-Test-User` was read unconditionally "because tests need it", and anyone on
   the internet could impersonate any user by sending a header.
   → **Decision:** the shim is read in exactly one place, guarded by
   `config.appEnv === 'test'`, decided once at boot from `APP_ENV`, never from
   the request. Same for `POST /api/test/reset`: in non-test it does not exist —
   it 404s like any unknown route. There is a test that asserts the header is
   ignored when APP_ENV !== 'test'. **This is Phase 1 — riskiest, so first.**

2. **Deleted links came back as 404 "unknown code".**
   The delete was a hard `DELETE FROM links`, so a dead link is indistinguishable
   from a code that never existed, and the alias silently became re-usable.
   → **Decision:** delete is a **soft delete** (`deleted_at`). A visit to a
   deleted code returns **410 Gone** with a body that says it was deleted, not
   404. The row stays, so its code/alias stays taken and can never be re-issued.
   Uniqueness is enforced by the DB, not by application memory.

3. **Two links got the same code.**
   The generator did `SELECT ... WHERE code = ?` then `INSERT` — a race, and a
   custom alias that collided with an auto-code slipped through because they were
   checked against different tables/paths.
   → **Decision:** ONE namespace. `code` is the PRIMARY KEY / UNIQUE column;
   an alias is just a caller-supplied code. Collisions are caught by the
   **UNIQUE constraint on insert**, not by a pre-check. Auto-generation retries
   on constraint violation. A colliding alias is **409 Conflict**.

4. **Expiry was compared as a string, or in the wrong timezone.**
   `expiresAt` came in as ISO-8601, got stored verbatim, and `'2026-01-01' > ...`
   compared lexicographically — so links expired early, late, or never.
   → **Decision:** parse to **epoch milliseconds (INTEGER)** at the boundary and
   store that. All comparisons are integer comparisons against `now()`. Time is
   read through a single injectable `clock` so tests can move it without sleeping.
   An expiry in the past at creation time is **400**, not a link born dead.

5. **The rate limiter told the caller "no" but not "for how long".**
   Returned a bare 429. Spec explicitly requires the wait time.
   → **Decision:** 429 carries a **`Retry-After` header (seconds)** *and*
   `retryAfterSeconds` in the JSON body. Fixed 60s window keyed by IP, 10
   creates per window. Only `POST /api/links` is limited. `X-Forwarded-For` is
   only trusted when `TRUST_PROXY=1`, otherwise the socket address is used —
   otherwise the limit is bypassable by forging a header.

6. **The test suite hit the real email provider.**
   Magic-link sign-in called Postmark/SES in a test, so `npm test` needed network
   and a key, and CI failed offline.
   → **Decision:** **offline-first**. `EmailSender` is an interface with two
   implementations — `ConsoleEmailSender` (fake, records sent mail in memory) and
   `HttpEmailSender` (real, POSTs to a provider) — **selected by config at boot**,
   never by an ad-hoc mock in a test. Test env always gets the fake. The real
   sender is never constructed under `APP_ENV=test`.

7. **A user could read or delete someone else's links.**
   `GET /api/links` selected everything; `DELETE /api/links/:code` matched on code
   alone, so anyone signed in could delete any link by guessing a code.
   → **Decision:** every owner-scoped query carries `WHERE user_id = ?` in the SQL
   itself. Deleting a link you do not own returns **404** (not 403 — you are not
   entitled to learn that it exists). Tests assert cross-user isolation directly.

8. **"It works" was asserted, never demonstrated.**
   → **Decision:** every phase ends with a real `npm test` run whose output I have
   actually read, plus a live curl against the running server. Evidence, not claims.

---

## Phases — ordered by what could kill the build, riskiest first

| # | Phase | Why here | Done when |
|---|---|---|---|
| 0 | Skeleton: config, clock, ports, DB schema, migrations, server bootstrap | Everything else sits on it | `PORT=3101 APP_ENV=test node server.mjs` boots and serves `/healthz` |
| 1 | **Auth + the test shim** | The single most dangerous thing here. A leaky shim is a full auth bypass in prod. Build it first, prove it's inert outside test. | Shim works under `APP_ENV=test`; header **ignored** under `APP_ENV=prod` (test proves it); magic-link flow works against the fake sender |
| 2 | **Codes, aliases, uniqueness** | Data-integrity risk. Two links sharing a code is unrecoverable once it's shipped. | Auto-code + custom alias; DB-level UNIQUE; alias collision → 409; generator retries |
| 3 | **Redirect + hit counting + expiry + delete semantics** | The core promise, and where 410-vs-404 lives. | 302 + hit++; expired → 410; deleted → **410 Gone**; never-existed → 404; survives restart |
| 4 | **Rate limiting** | Real but contained; wrong answer = a DoS hole, not corruption. | 10/min/IP; 11th → 429 + `Retry-After` + `retryAfterSeconds` |
| 5 | Dashboard (`GET /api/links`) + owner isolation | Straightforward once 1–3 hold | Own links only, with hits + expiresAt; cross-user leak test passes |
| 6 | README + ship | | One-command start documented; full suite green |

Phases 1–3 are the ones that can kill this. They go first, before anything cosmetic.

## Ports & adapters (offline-first)

| Port | Fake (test/dev) | Real (prod) | Selected by |
|---|---|---|---|
| `EmailSender` | `ConsoleEmailSender` — records in memory | `HttpEmailSender` — POST to provider | `config.email.driver` |
| `Clock` | `FakeClock` — advanceable | `SystemClock` | `config.appEnv` / DI |
| `IdGenerator` | `SeededIdGenerator` | `CryptoIdGenerator` (`crypto.randomBytes`) | DI |

No test ever monkey-patches a module. Tests construct the app with fakes.

## Status codes — the true one, not the convenient one

| Situation | Code |
|---|---|
| Link created | 201 |
| Deleted | 204 |
| Redirect | 302 |
| Bad/missing URL, bad alias, expiry in the past, malformed date | 400 |
| No/invalid credentials | 401 |
| Alias already taken | 409 |
| Code never existed / not yours | 404 |
| **Code existed and was deleted** | **410 Gone** |
| **Code existed and expired** | **410 Gone** |
| Over the create rate limit | 429 + `Retry-After` |
