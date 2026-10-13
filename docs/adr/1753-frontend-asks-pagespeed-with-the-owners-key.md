# ADR 1753 — `frontend` asks PageSpeed with the owner's key and pins a Next.js Vercel will deploy; `tls` never fails on a cached scan

**Status:** accepted
**Date:** 2026-10-13
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a Lighthouse answerer with a free keyless quota that holds for a real run, or Vercel lifting its Next.js version block

## Context

The first real `frontend` run on `arc-sandbox` (2026-10-13) hit two walls in a row, neither visible on the fakes.

1. Vercel built the shell and then refused to deploy it: `VULNERABLE_NEXTJS_VERSION`. The shell pinned Next 15.5.4.
2. Once a patched shell was live and answered 200 with launch's generator mark, PageSpeed answered
   `429 Quota exceeded ... 'Queries per day'` before the run ever asked. Keyless calls share one Google-wide daily
   quota, so `verify` reads `UNSCANNED(pagespeed quota (429))` on most days for every venture: the slot can never verify.
3. `tls` then failed with "no HSTS" while the live site sent `strict-transport-security: max-age=63072000`. SSL Labs
   had answered from a cached scan (up to a day old) of the pre-frontend 404 deployment.
   A fresh scan still read "no HSTS": Vercel answers SSL Labs' own HTTP request `403` (`httpStatusCode: 403`), and a
   403 carries no header, so the scanner's HSTS reading is blind there rather than absent.

## Options considered

1. **Keep keyless; retry on another day** — no change / the proof depends on strangers' traffic, so it is not a proof.
2. **Drop the Lighthouse half of verify** — removes the quality bar ADR-1730 set; a 200 alone cannot detect a slow or broken page.
3. **Declare `PAGESPEED_API_KEY` in the row's `env_keys` and the adapter's `envContract()`; send it on the PageSpeed call only** — one owner key (Google Cloud, PageSpeed Insights API only, free), a per-project quota.

## Decision

Option 3, and the shell pins Next 15.5.27 / React 19.1.9 (the patched 15.x backport line).

The key is required, like every declared key: without it the worker stops the attempt with `env:PAGESPEED_API_KEY`
instead of spending an attempt on a 429. It rides only in the PageSpeed query string; no reason, evidence or log
line carries it. A quota or error answer is still `UNSCANNED(reason)`, never a pass.

`tls` keeps reading the cache first, but a cached answer may only pass: a failing one starts one fresh scan
(`startNew=on`), and only a fresh scan's failure fails the slot.

The grade stays SSL Labs'. Only an endpoint whose scanner request got a non-2xx/3xx status has its HSTS read from
the venture itself (one browser-shaped GET; `max-age` above 0), and the answerer names both. An endpoint SSL Labs
reached and saw without HSTS still fails, whatever the venture says. The tls row gains the venture host.

## Consequences

Every venture's owner creates one PageSpeed key before `frontend`; it belongs in the launch env file beside the other
provider keys. Pinned by `launch-contract: the steel thread -- release lifts the hold and tags it once, frontend
commits the shell once and the live page passes` (every PageSpeed call carries the key; no answer repeats it) and
`launch-contract: tls never fails on a stale cached scan -- it rescans once, and a fresh failure still fails` and
`launch-contract: tls reads HSTS from the venture only when the host refused SSL Labs, never over a scanner that saw it absent`.
