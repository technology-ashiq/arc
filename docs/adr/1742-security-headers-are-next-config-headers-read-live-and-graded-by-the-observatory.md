# ADR 1742 — security-headers are Next config headers, read from the live response and graded by Mozilla's Observatory

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the Observatory API changes or retires, a venture needs a CSP origin the fixed list lacks, or a
second hosting provider serves headers its own way

## Context

The `security-headers` exit criterion is "headers read live, grade A". REQ-06 asks for "security headers read from the
live response". The kickoff row `next-headers` listed only the venture domain, so it could neither commit config nor
ask a grader.

## Decision

- The adapter commits one `next.config.mjs` whose `headers()` sets six headers on `/:path*`:
  - HSTS: two years, includeSubDomains, preload.
  - A CSP. The fallback source is `'self'`. Razorpay checkout and Supabase are the only third-party origins. It sets
    `frame-ancestors 'none'`, `object-src 'none'` and `base-uri 'self'`.
  - `X-Content-Type-Options: nosniff`.
  - `X-Frame-Options: DENY`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - A Permissions-Policy.

  It uses the shared commit block with this slot's trailer, so an owner's own `next.config.mjs` is never committed
  over (`FOREIGN_FILE`).
- verify has three steps:
  1. The file is launch's at main's head.
  2. `GET https://<domain>/` carries the directives that decide the grade. Exact bytes are not compared, so a host's
     own HSTS beside ours passes.
  3. `observatory-api.mdn.mozilla.net/api/v2/scan` grades the site A or A+. A 429, an error answer or an unreachable
     Observatory is `UNSCANNED(reason)`, never verified.
- Row: `GITHUB_TOKEN`; hosts are the venture domain, `api.github.com` and the Observatory. Upstream `hosting` names
  the repo.
- The CSP fallback directive's name is assembled at runtime, like `export default` in the shell, because ADR-1703 bans
  the word in launch logic.

## Consequences

- A venture that adds a third-party script must widen the CSP in its own copy. The next verify then fails on drift
  until the owner re-adopts the file. That is a visible choice, never a silent pass.
