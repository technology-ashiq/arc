# REVIEW — Review Army pass over the snip diff

Three specialists reviewed the built diff. Every finding was *probed against the running
code*, not asserted from reading it. Non-issues are recorded as such: "we checked and it
holds" is worth as much as a fix.

## 1. Security review

| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | **Dashboard built table rows with `innerHTML` from a user-supplied URL.** Probe: `new URL('https://x.test/a"><img src=x>')` normalises to `a%22%3E%3Cimg...` — WHATWG parsing escapes `<`, `>`, `"`, so it is **not** exploitable today. But it is safe only by accident of someone else's normalisation; one future path that stores an unnormalised URL makes it stored XSS. | Medium (latent) | **Fixed** — rows built with `createElement` + `textContent`. Regression test added. |
| S2 | Magic tokens retained forever (used and expired alike). A stolen DB backup is a bag of live sign-in tokens. | Medium | **Fixed** — `createMagicToken` purges `used_at IS NOT NULL OR expires_at < now` on every write. |
| S3 | Test auth shim leaking into prod. | Critical if wrong | **Verified safe.** `X-Test-User` is read in exactly one place (`lib/auth.mjs:authenticate`) behind `config.isTest`, computed once at boot from a frozen object. A test boots a real server at `APP_ENV=dev` and asserts the header does nothing. |
| S4 | Rate-limit evasion via spoofed `X-Forwarded-For`. | High | **Verified safe.** XFF honoured only when `TRUST_PROXY=1`. Covered by a test. |
| S5 | `javascript:`/`data:` URLs turning the shortener into an XSS delivery service. | High | **Verified safe.** http/https allow-list; test asserts 400 for `javascript:`, `data:`, `file:`, `ftp:`. |
| S6 | IDOR on `DELETE /api/links/:code`. | High | **Verified safe.** Query scoped by `owner_email`; another user's code answers 404, not 403 — a 403 would confirm it exists. |
| S7 | User enumeration on `/api/auth/request`. | Low | **Verified safe.** Always 202; test asserts identical bodies for valid and invalid addresses. |
| S8 | **Unauthenticated POSTs to `/api/links` are not rate limited** — auth runs before the limiter, so a flood of 401s is not throttled. | Low | **Accepted, documented.** No link can be created that way; a 401 costs one HMAC verify. A real fix needs a second, cheaper limiter ahead of auth. In README §Known limits. |
| S9 | Open redirect. | By design | A shortener *is* an open redirect. Constrained to http/https, `Cache-Control: no-store` on the 302. |

## 2. Correctness / edge-case review

| # | Finding | Severity | Status |
|---|---|---|---|
| C1 | **`GET /%E0%A4%A` returned 500.** `decodeURIComponent` throws `URIError` on a malformed percent-escape and was called raw in the router, so a *bad short code* came back as an internal server error. Probe confirmed the throw. | High | **Fixed** — `safeDecode` returns null; router answers `404 link_not_found`. Regression test covers `/%E0%A4%A`, `/%zz`, `/%` and the DELETE path. |
| C2 | `config.maxUrlLength` declared but never used; `links.mjs` hard-coded 2048. Config that lies is worse than no config. | Low | **Fixed** — wired through `createLinkStore(db, config)`; test asserts the limit. |
| C3 | Generated-code collision via a `SELECT`-then-`INSERT` race. | High | **Safe by construction.** The UNIQUE index is the arbiter: INSERT is attempted, a violation triggers a retry (generated) or a 409 (alias). No TOCTOU window. |
| C4 | Hit counter losing writes under concurrency. | Medium | **Safe.** `SET hits = hits + 1` is atomic; never read-modify-write. |
| C5 | Expiry boundary. | Low | **Safe.** `expires_at <= now` is expired on read, and the same predicate rejects a past `expiresAt` at creation — no window where a link is creatable but already dead. |
| C6 | Case-sensitive aliases: `MY-LINK` shadowing `my-link`. | Medium | **Safe.** Unique index is on `code_lower`; test asserts the cased duplicate is a 409. |
| C7 | Owner sees expired-but-undeleted links in `GET /api/links`. | — | **Correct as-is.** The owner should see a link that stopped working; `expiresAt` says why. |

## 3. Data-migration / persistence review

| # | Finding | Severity | Status |
|---|---|---|---|
| D1 | **A deleted code must never be re-issued.** Had the unique index excluded soft-deleted rows, an attacker could re-register a victim's dead alias — a `410 Gone` would quietly become a `302` to *their* URL, and every old inbound link would follow. | High | **By design, now proven.** Unique index spans deleted rows. Test: re-registering a dead alias → 409, code still 410s. |
| D2 | Durability across restart (WAL checkpoint on shutdown). | High | **Verified.** SIGTERM closes the DB; a fresh process on the same file sees links, hits (`3` = 2 before + 1 after) and deletions. Two restart tests. |
| D3 | Schema evolution. | Medium | **Handled.** `PRAGMA user_version` + ordered `MIGRATIONS`, each in a transaction with rollback. Adding v2 is append-only. |
| D4 | `magic_tokens` grew unboundedly. | Medium | **Fixed** — see S2. |
| D5 | `links` rows are never hard-deleted; the table only grows. | Accepted | **Intentional and load-bearing.** The tombstone *is* the 410 and is what keeps a code burned (D1). Purging tombstones would resurrect codes. Retention would need a separate `codes_burned` table. |
| D6 | Timestamps: epoch-ms INTEGER in storage, ISO-8601 on the wire. | — | **Verified.** No timezone ambiguity; `expiresAt` round-trips as ISO. |
| D7 | Tests writing to the dev database. | Medium | **Safe.** `DB_PATH` is env-injected; every suite gets a fresh `mkdtemp` dir and cleans up. |

## Outcome
4 defects found and fixed (1 high, 2 medium, 1 low); 1 accepted with documentation (S8);
1 accepted by design (D5). Tests 20 → 23, all green.
