# SPEC — snip (URL shortener)

Status: LOCKED (ambiguities resolved below; no coding may start before this file exists)

## 1. Product statements (from the request)
- S1 A signed-in user can create a short link from a long URL.
- S2 Anyone visiting a short link is redirected to the long URL and the visit is counted.
- S3 A signed-in user sees only their own links, with hit counts, and may delete any of them.
- S4 Sign-in is by email magic link.
- S5 Links persist in SQLite across restart.
- S6 Codes auto-generated; custom alias allowed; codes/aliases globally unique.
- S7 Optional expiry; expired links do not redirect.
- S8 Delete: link no longer redirects, and the response must say GONE, not UNKNOWN.
- S9 Create is rate limited to 10/min per IP; over-limit response says how long to wait.
- S10 Test suite runs with no network access; no live third-party (email) calls in the test path.

## 2. Ambiguity interrogation

For each requirement I ask: what is unspecified about (a) edge-case behaviour, (b) error semantics,
(c) data model, (d) external dependencies? Every material ambiguity below is CLOSED by a numbered
decision in §3. An unresolved ambiguity is a defect.

| # | Requirement | Ambiguity found | Axis |
|---|---|---|---|
| A1 | S1 | What counts as a valid URL? Are `javascript:`/`file:` accepted? | edge case |
| A2 | S1 | Is a request with no/expired auth 401 or 403? | error semantics |
| A3 | S6 | Charset/length of auto codes? Collision handling? | data model |
| A4 | S6 | What alias strings are legal? Can an alias collide with a real route (`api`, `dashboard`)? | edge case |
| A5 | S6 | "Two links can never share a code or alias" — does a DELETED link still hold its code? | data model |
| A6 | S6 | Alias already taken → which status? | error semantics |
| A7 | S7 | Is an expiry in the past accepted at creation? What does an expired link return on GET /:code? | edge case |
| A8 | S7 | Are expired links still listed on the dashboard? | edge case |
| A9 | S2 | Are hits counted for expired/deleted/unknown codes? Is 302 or 301 correct? | edge case |
| A10 | S8 | 404 vs 410 for a deleted code; and what about a code that never existed? | error semantics |
| A11 | S3 | Deleting a code that belongs to another user → 404 or 403? Deleting twice? | error semantics |
| A12 | S9 | Which IP? Do failed/rejected creates consume quota? Fixed or sliding window? What status/format tells the caller to wait? | edge case |
| A13 | S9 | Is the rate limit per IP only, or per user too? | data model |
| A14 | S4/S10 | How is the magic link "sent" when there is no email provider? | external dep |
| A15 | Auth shim | Exactly how is `X-Test-User` neutralised outside test mode? | external dep |
| A16 | S5 | Where does the DB file live; is it created on first run? | data model |
| A17 | Reset | What does `/api/test/reset` wipe, and what if `APP_ENV != test`? | error semantics |
| A18 | `shortUrl` | What base URL is used to build it? | external dep |

## 3. Decisions (locked assumptions) — resolve every ambiguity above

1. **Valid URL (A1):** body `url` must parse with `new URL()` and have protocol `http:` or `https:`.
   Anything else (`javascript:`, `file:`, unparseable, missing, non-string, >2048 chars) → `400`
   `{ "error": "invalid_url", ... }`. No SSRF/DNS check is performed (would need network).
2. **Unauthenticated (A2):** any `/api/links*` call without a valid identity → `401`
   `{ "error": "unauthenticated" }` (not 403 — the caller has no identity, rather than an
   insufficient one).
3. **Auto codes (A3):** 7 chars from `[0-9a-zA-Z]` via `crypto.randomInt`. Insert is retried on
   UNIQUE violation up to 5 times; after that → `500 code_generation_failed`. Uniqueness is
   enforced by a DB `UNIQUE` constraint, never by a read-then-write race.
4. **Legal alias (A4):** `^[A-Za-z0-9_-]{3,32}$`, case-sensitive, and not in the reserved set
   {`api`, `dashboard`, `login`, `logout`, `health`, `favicon.ico`, `robots.txt`, `static`}.
   Violation → `400 invalid_alias`. Reserved → `409 alias_reserved`.
5. **Codes are never recycled (A5):** delete is a **soft delete** (`deleted_at` set). The row keeps
   its code, so the code stays unique forever and we can still tell "deleted" from "never existed".
6. **Alias taken (A6):** `409 alias_taken` — including when the taken alias belongs to a *deleted*
   link (decision 5) and including when it belongs to another user.
7. **Expiry (A7):** `expiresAt` must be an ISO-8601 timestamp parseable by `Date`; a value in the
   past or non-parseable → `400 invalid_expiry`. Expiry is stored as epoch-ms; comparison is
   `now >= expires_at` ⇒ expired. `GET /:code` on an expired link → `410 Gone` (it existed; it is
   no longer usable). Omitted/`null` ⇒ never expires.
8. **Expired links still listed (A8):** they remain on `GET /api/links` with their `expiresAt`, so
   the owner can see why they stopped working. Deleted links are NOT listed.
9. **Redirect (A9):** `302` with `Location: <long url>`. The hit counter is incremented **only** on
   a successful redirect — never for unknown (404), deleted (410) or expired (410) codes.
10. **Deleted vs unknown (A10):** deleted code → `410 Gone` `{ "error": "gone" }`. Never-existed
    code → `404 Not Found` `{ "error": "not_found" }`. This is the whole point of S8.
11. **Delete semantics (A11):** `DELETE /api/links/:code` → `204` when the caller owns a live link.
    A code owned by *someone else* → `404 not_found` (do not leak another user's namespace).
    Deleting an already-deleted link the caller owns → `410 gone` (idempotent in effect: still not
    redirecting, and the truth is told). Unknown code → `404`.
12. **Rate limit (A12):** 10 successful-or-attempted `POST /api/links` per **60s sliding window**
    per client IP. Only requests that reach the handler count; requests rejected by the limiter do
    not add to the window (no punishment spiral). Over limit → `429`
    `{ "error": "rate_limited", "retryAfterSeconds": N }` **and** a `Retry-After: N` header, where
    N = seconds until the oldest request in the window expires (rounded up, min 1).
13. **IP source (A13):** limiter key = `X-Forwarded-For` first hop if present, else the socket
    remote address. Limit is per IP only (as specified), not per user.
14. **Email is an interface (A14):** `Mailer` interface with two impls — `ConsoleMailer` (dev/test:
    records the link in memory / logs it, sends nothing) and `SmtpMailer` (prod: would call the
    provider; selected only when `APP_ENV=production` and SMTP env vars are set). In `test`/`dev`
    the console mailer is wired, so no test ever touches the network. Magic-link tokens are
    32 random bytes, single-use, 15-minute TTL, stored hashed (sha256) in the DB.
15. **Test shim isolation (A15):** the `X-Test-User` header is read **only** inside
    `if (env.APP_ENV === 'test')`. Outside test mode the header is never read, so it cannot
    authenticate anyone; the only path is the magic-link session cookie (`snip_session`, HttpOnly).
    A regression test asserts a non-test server ignores the header (401).
16. **DB (A16):** `node:sqlite` `DatabaseSync` at `./data/snip.db`, directory created on boot,
    schema applied idempotently (`CREATE TABLE IF NOT EXISTS`), `journal_mode=WAL`,
    `foreign_keys=ON`. Tests use their own temp file so they never clobber dev data.
17. **Reset (A17):** `POST /api/test/reset` → `204`, deletes all rows from `links` (and users,
    sessions, magic tokens) and clears the in-memory rate-limit state. When `APP_ENV !== 'test'`
    the route does not exist at all → `404`.
18. **shortUrl (A18):** `${BASE_URL ?? 'http://localhost:' + PORT}/${code}`.

## 4. API contract (fixed)
| Method | Path | Success | Failure modes |
|---|---|---|---|
| POST | `/api/links` | `201 {code, shortUrl}` | 400 invalid_url / invalid_alias / invalid_expiry · 401 · 409 alias_taken/alias_reserved · 429 |
| GET | `/api/links` | `200 [{code,url,hits,expiresAt}]` | 401 |
| DELETE | `/api/links/:code` | `204` | 401 · 404 not_found · 410 gone |
| GET | `/:code` | `302 → url` (hit+1) | 404 not_found · 410 gone (deleted or expired) |
| POST | `/api/test/reset` | `204` (test only) | 404 outside test |
| POST | `/api/auth/magic-link` | `202 {sent:true}` | 400 invalid_email |
| GET | `/api/auth/callback?token` | `302 → /dashboard` + session cookie | 400/401 invalid_token |

## 5. Definition of done
- `PORT=3103 APP_ENV=test node server.mjs` boots and serves.
- `npm test` green, offline.
- `README.md` gives the one-command start.
- Every decision 1–18 is covered by at least one test.
