# ADR 1749 — the trust fixtures sweep every built adapter, not one fake

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the first vetted real adapter (REQ-09's own wording), or an adapter that legitimately needs a
host the fence cannot express

## Context

REQ-09: "the Phase 00 trust fixtures re-run against every vetted real adapter". No row is vetted yet. Every vet needs
the owner's tokens, so a sweep limited to vetted rows would check nothing today, and it would pass while checking
nothing.

## Decision

`tests/launch/trust-all.mjs` runs over every registry row whose adapter file exists. It prints the count first, and
the bats test requires 28 or more, so an empty sweep fails. For each adapter:

- **digest:** a CRLF copy keeps the digest; a one-byte edit changes it; `checkAdapter` on a row pinned to the old
  digest refuses `DIGEST_DRIFT`.
- **hosts:** `scaffold` and `verify` run under the real ctx, with a row whose `hosts[]` names only `fixture.invalid`
  and a global fetch that counts every request. Zero requests may leave for any adapter, and at least four adapters
  must reach a request that ctx refuses as `HOST_REFUSED`.
- **write:** `ctx.write("../outside.txt")` throws `WRITE_REFUSED`.
- **sensitive:** each `sensitive_actions[]` entry is `APPROVAL_PENDING` until approved, then allowed. Two exist today:
  github `delete` and release `deploy-prod-first`.

When a row becomes vetted, it is already in the sweep. Nothing needs adding.
