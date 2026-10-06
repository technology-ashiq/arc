# ADR 1729 — The secrets contract is the venture repo's `.env.example`; launch reads names, never values

**Status:** accepted
**Date:** 2026-10-05
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture whose runtime keys live somewhere other than its host's env store (a vault, a KMS)

## Context

The `secrets` exit criterion is "contract lint; no key in git; owner places keys". The `vercel-env-store` row could list
env var names and nothing else, so there was no contract to lint against, and nothing that could see git. LAU-M says
launch never fetches a key, and a value read by an adapter would reach state, receipts or a log.

## Options considered

1. **A names list in the venture profile** — one more field launch owns / drifts from the code that reads the keys.
2. **The venture repo's `.env.example`** — the file the venture's own code and its developers already keep, versioned
   beside the code that needs the keys.

## Decision

Option 2. `secrets` commits `.env.example` (a header, no names) when the repo has none, with its `Arc-Launch-Tag`
trailer (ADR-1726); later slots that add a runtime key add its NAME there. The contract is every `NAME=` line in that
file on `main`. verify asks Vercel for the project's env var keys with no `decrypt` parameter and reads `key` and
`target` only, and asks GitHub for `main`'s tree: it passes when every contract name is set for `production` and no
`.env` file other than `.env.example` is in the tree. A missing name is not a failure of launch: the reason names it for
the owner to place. The row gains `api.github.com` and `GITHUB_TOKEN`.

## Consequences

An adapter that writes a value is refused by review, not by code: the Vercel answer carries encrypted values the adapter
never reads. The weekly verify (REQ-10) re-checks both halves, so a `.env` committed later is caught.
