# Phase 07 S2 + S3 -- the real Stitch transport, and vendoring at fetch

Text only (LexOS ruling 2026-09-16): no draft, no asset and no PNG is committed. Everything named here
is local state under `.claude/state/` or the gitignored `docs/design/explore/*/rival-*/`.

## S2 -- the real transport, one contract run (2026-10-07)

- Command: `node .claude/scripts/design/design-rival.mjs draft --brief lexos-case-workspace --run p07-s2-contract`
- SDK: `@google/stitch-sdk@0.3.5`, installed once into `.claude/state/design/rival-sdk/` with a private
  HOME and npm config (no `npx`, no repo `package.json` change). Key from the owner key store, passed to
  the child transport by environment only.
- Request: the WHOLE brief, 11,802 bytes, sha256 `a1ef89b7bbf6d211...` (the file the composers read);
  `deviceType: DESKTOP`.
- Answer: screen `6862528e2b9e401f88db573e1fdc6cda`, HTML from `contribution.usercontent.google.com`,
  38,520 bytes, sha256 `859a8307bdc85b5c...`. Schema as in the Phase 06 receipt. 167.7 s end to end
  including the first install.
- Status line: `rival stitch: DRAFTED 38520 bytes (stitch-sdk 0.3.5, screen 6862528e2b9e)`.
- **Found on the run:** the process exited 127 after a good draft -- `process.exit()` while fetch's
  socket was closing trips a libuv assertion on Windows. Fixed: `process.exitCode`, and the process ends
  on its own.

## S3 -- vendoring (ADR-1422), on the real draft

The real draft names `cdn.tailwindcss.com` (runtime script), `fonts.googleapis.com` (three stylesheet
links, two distinct) and two preconnect hints. Vendored with the real CDNs:

- 17 assets, 1,856,206 bytes: 1 from `cdn.tailwindcss.com`, 2 from `fonts.googleapis.com`, 14 woff2
  from `fonts.gstatic.com`. 53 `src`/`href`/`url()` rewrites, every one recorded in `vendor.json`.
- Tailwind's unversioned URL answers 302 to `/3.4.17?plugins=forms@0.5.10,container-queries@0.1.1`; a
  redirect is followed only on the same host over https, and the final URL is recorded -- the version
  the jury actually sees (destroyed signal 1 of ADR-1422, now written down with its number).
- Vendored page: 38,196 bytes, sha256 `c3bef687da49bd01...`, no remote host left in it.

**Offline proof.** The explore render is served from loopback under `default-src 'self'` and refuses
the capture if any request leaves the page's own directory (ADR-1418):

| Render | Result |
|---|---|
| vendored page, session `p07-s3` | rendered, screenshot_sha256 `12d54e6c833b52ec...` |
| the RAW draft, same route shape (negative control) | **REFUSED** -- three `style-src-elem` violations, one per Google Fonts stylesheet |
| vendored page again, sessions `p07-s3c`/`p07-s3d` | refused as **identical pixels already recorded** for the route -- the determinism check, same hash |

Opened in-session before any verdict: Tailwind applied, Inter and JetBrains Mono loaded, Material
Symbols icons drawn. Phase 06's self-containment check fails on the raw draft and passes on the
vendored one.

**Found on the run:** a preconnect hint rewritten to `assets/` opened an idle socket to the loopback
server, which timed it out and recorded `malformed ERR_HTTP_REQUEST_TIMEOUT`, refusing the render. It is
now `about:blank`, which opens nothing; the first render had passed only on timing.
