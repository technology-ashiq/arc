# PROGRESS — snip

## Now
**All 6 phases closed. 33/33 tests green.** Nothing is in flight.

## Done

| Phase | State | Evidence |
|---|---|---|
| 0 — skeleton: config, ports, sqlite schema | done | boots; `/healthz` 200 |
| 1 — auth + `X-Test-User` shim (riskiest) | done | 8 tests, incl. "header ignored under APP_ENV=prod" and "test env refuses a network email driver" |
| 2 — codes, aliases, uniqueness | done | 409 on a taken alias; a seeded generator forced to collide with an existing alias retries |
| 3 — redirect, hits, expiry, delete | done | 302 + hit++; expired → 410; deleted → **410 Gone**; unknown → 404; survives a restart |
| 4 — rate limiting | done | 10/min/IP; 11th → 429 + `Retry-After: 60` + `retryAfterSeconds`; a forged `X-Forwarded-For` does not reset the bucket |
| 5 — dashboard + owner isolation | done | own links only, with hits + expiresAt; cross-user read and delete both denied |
| 6 — README + ship | done | one-command start documented |

## Verified live (not only in tests)
Booted with exactly `PORT=3101 APP_ENV=test node server.mjs`:
- create (auto code + custom alias); 409 on a duplicate alias
- `GET /docs` → `302 → https://example.com/docs`, hit counted
- delete → `GET /docs` → **`410 link_deleted`**; `GET /never` → **`404 unknown_code`**
- 12 rapid creates → `201` x10 then `429` with `retry-after: 60`
- killed the process, restarted: links and hit counts were still there

## Deliberate decisions a cold reader should know
- **Delete is a soft delete.** The row stays, so the code can never be re-issued and a
  dead link never looks "unknown". That is why it is 410, not 404.
- **Deleting someone else's link is 404, not 403** — you are not entitled to learn that
  the code exists.
- **Expiry is stored as epoch ms**, never as a string, so nothing is ever compared
  lexicographically. Time comes from an injectable clock, so tests never sleep.
- **The shim is read in exactly one place** (`src/auth.mjs`), gated on the boot-time
  `APP_ENV`. It cannot become a production auth bypass.

## Not built (out of scope — not pretended otherwise)
- No HTML UI. The dashboard is `GET /api/links` (JSON).
- No pagination on the dashboard; no per-hit analytics (just a counter).
- Sessions are not revocable (no sign-out route).
- The rate limiter is per-database; a multi-node deployment would need a shared store.
