# PLAN — snip

## Architecture (draft 1)
- `server.mjs` — node:http, hand-rolled router, no framework (zero deps = nothing to audit).
- `lib/db.mjs` — `node:sqlite` `DatabaseSync`, WAL, versioned migration via `PRAGMA user_version`.
- `lib/links.mjs` — create / list / delete / resolve+count. All SQL lives here.
- `lib/auth.mjs` — session cookie (HMAC-signed), magic-token issue/consume, `APP_ENV` gate.
- `lib/mailer.mjs` — Mailer interface + 3 impls: `memory` (tests), `console` (dev), `smtp` (prod). Offline-first.
- `lib/ratelimit.mjs` — sliding window, 10/min/IP, in-memory.
- `public/index.html` — the dashboard (one page, fetch against the API).

### Data model (draft 1)
`links(id, code, code_lower UNIQUE, url, owner_email, hits, expires_at, created_at, deleted_at)`
Soft delete. `code_lower` unique index = the single source of truth for "no two links share a code".

---

## Persona review

### CEO — is this the smallest thing that satisfies the user?
- **Cut:** users table (email string on the link is enough), click-event log, JS build step, any npm dep. Zero dependencies.
- **Keep:** the dashboard — requirement says "see their own links on a dashboard", so a static page is not scope creep, it's the ask.
- **Scope creep flagged:** SMTP impl. Prod needs *a* real path, so I ship the interface + a console impl + an SMTP stub selected by env — but I do **not** wire a live provider. Cheap, honest, and keeps tests offline.
- **Verdict:** ship 7 files.

### Engineer — what breaks in production?
1. **Code collision race.** Two requests generate the same random code → `INSERT` must be the arbiter, not a `SELECT`-then-`INSERT`. → catch `SQLITE_CONSTRAINT` and retry (5x) for generated codes; for a *user-supplied alias* the same constraint returns **409**, never a retry.
2. **Deleted codes must stay burned.** If the unique index ignored soft-deleted rows, a deleted alias could be re-registered and a 410 would silently turn back into a 302 pointing somewhere else — a link-hijack. → unique index covers deleted rows too; re-registering a dead alias = 409.
3. **Hit counting.** `UPDATE ... SET hits = hits + 1` (atomic in SQLite), never read-modify-write.
4. **Clock/expiry.** Store epoch-ms INTEGER, not ISO text; compare numerically. Return ISO on the wire.
5. **Restart durability.** `data/` must exist before open; WAL on; the DB path is env-overridable (`DB_PATH`) so tests never touch the dev DB.
6. **Rate-limit map leak.** Unbounded `Map` of IPs = slow OOM. → prune the bucket on touch + an unref'd 60s global sweep.

### Design/DX — is the API coherent to a consumer?
- Every error is `{"error": <code>, "message": <human>}`. A 429 also carries `retryAfterSeconds` **and** the standard `Retry-After` header — a client shouldn't have to parse prose to know how long to wait.
- `expiresAt` is ISO-8601 in *and* out; `null` when unset. Never mix formats.
- `410` bodies say which kind of gone it is (`link_deleted` vs `link_expired`) — same status, distinguishable cause.
- `shortUrl` is absolute (`BASE_URL` or the request's own host) so the caller can paste it, not assemble it.

### Security — what's the abuse case?
1. **`javascript:`/`data:` URLs** → a shortener becomes a stored-XSS launcher. → allow-list `http`/`https` only, and cap URL length.
2. **The test shim is the whole auth system if it leaks.** `X-Test-User` must be read **only** when `APP_ENV === 'test'`, decided once at boot from a frozen config — no per-request re-read, no truthy-string bug. Non-test builds must not even look at the header.
3. **Rate-limit evasion via `X-Forwarded-For` spoofing.** Honour XFF only when `TRUST_PROXY=1`; default to the socket address.
4. **Alias squatting on routes.** An alias `api`, `health`, or `` would shadow real routes. → reserved-word list + `^[A-Za-z0-9_-]{3,32}$`.
5. **Session forgery.** Cookie = `email|exp|HMAC-SHA256`, `timingSafeEqual` compare, HttpOnly + SameSite=Lax. `SESSION_SECRET` is **mandatory in production** (boot fails without it), ephemeral in dev/test.
6. **Magic-token theft/replay.** Store only the SHA-256 *hash* of the token, 15-min TTL, single use (`used_at`), constant-time lookup by hash.
7. **User enumeration.** `POST /api/auth/request` always returns 202, whatever the email.
8. **Body flood.** 8KB request-body cap.
9. **IDOR.** Every links query is keyed on `owner_email`; another user's code is a 404, not a 403 (a 403 confirms it exists).

## Plan (folded)
Draft 1 + all 9 security items + the 6 engineering items. Data-model change from the review: no `users` table; unique index spans deleted rows. Build order: db → mailer → auth → ratelimit → links → server → dashboard → tests.
