# ADR 1754 — `security-headers` sets the CSP with a per-request nonce, and the shell renders per request

**Status:** accepted
**Date:** 2026-10-13
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Next.js applying nonces to statically built pages, or the Observatory grading `'unsafe-inline'` beside a hash as A

## Context

The first real `security-headers` run on `arc-sandbox` (2026-10-13) served every header ADR-1742 asked for, and
Mozilla's HTTP Observatory graded it **B+ (80)**. That is not A. The one failing test was `csp-implemented-with-unsafe-inline` (−20):
`script-src 'self' 'unsafe-inline'` lets any injected inline script run, so the CSP does not stop XSS. Next.js needs
inline scripts for its own bootstrap. The documented way to allow them without `'unsafe-inline'` is a nonce: a
middleware sets a fresh nonce in the request's CSP, and Next puts it on its scripts. That only works on a page
rendered per request; a statically built page has no request to take the nonce from.

## Options considered

1. **Keep `'unsafe-inline'`; accept B+** — no change / breaks ADR-1742's A bar and leaves the CSP decorative.
2. **A fixed nonce or hash list in `next.config.mjs`** — a fixed nonce is no protection, and hashes change on every build.
3. **`middleware.js` sets the CSP with `'nonce-…' 'strict-dynamic'` per request; the shell's root layout is `force-dynamic`** — the Next-documented pattern.

## Decision

Option 3. `security-headers` commits `middleware.js` beside `next.config.mjs`. The CSP leaves the config; the
remaining five headers stay there. `frontend`'s root layout exports `dynamic = "force-dynamic"`.

verify proves the nonce works, not just that the header exists. script-src must carry a nonce and no `'unsafe-inline'`.
The page must serve at least one script tag, and every script tag must carry the nonce from the same response's CSP.
A statically built page fails that check by name, even when every header is right. `style-src` keeps
`'unsafe-inline'`: the shell uses style attributes, and the Observatory does not take points for it.

## Consequences

The venture's pages render per request (a tiny cost on a shell; Vercel serves them from functions). Any page a later
slot adds inherits the root layout's dynamic rendering. Pinned by `launch-contract: security-headers commits
next.config.mjs and a nonce middleware once, ...` and the unsafe-inline / static arms of `launch-contract:
security-headers is not ok when ...`.
