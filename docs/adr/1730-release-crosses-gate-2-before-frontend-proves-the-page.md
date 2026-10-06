# ADR 1730 — `release` crosses gate 2 before `frontend`; `frontend`'s verify is the first proof the venture serves

**Status:** accepted
**Date:** 2026-10-06
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a hosting provider whose previews a public scanner can read without lifting protection

## Context

`frontend`'s exit criterion is Lighthouse ≥ 90 in four categories, which only a live public URL can answer. Production
is held until gate 2 (ADR-1727) and Vercel protects previews behind its own login by default, so before `release` no
public URL exists for a scanner to read. The catalog had `frontend` depend on `repo` alone, which would leave it
pending until something outside its own DAG ran.

## Options considered

1. **Lift preview protection** — `frontend` verifies before gate 2 / every preview of the venture becomes public.
2. **`frontend` depends on `release`** — gate 2 is crossed first; `frontend` commits the shell to `main`, production
   builds it, and its verify reads the live domain.

## Decision

Option 2. `frontend.depends_on` = `repo`, `release`. `release` asks for `deploy-prod-first` (its sensitive action),
then lifts the hold by committing `vercel.json` as `{}` with the trailer `Arc-Launch-Tag: <slug>@release@arc-ship-release`
(the exact line `hosting` reads, ADR-1727), and tags that commit `launch-release-1`. Its verify is the deploy receipt:
Vercel holds a production deployment of the tagged commit that was BUILT, not skipped (READY, or ERROR while `main` has
no app yet). `frontend` commits the Next shell through the Git Data API in one commit (ADR-1726); its verify fetches
`https://<brand.domain>/` (HTTP 200 from the venture itself) and asks PageSpeed Insights for the four categories.
A PageSpeed quota or error answer is `UNSCANNED(reason)`. The `nextjs-shell` row gains `api.github.com`,
`www.googleapis.com` and `GITHUB_TOKEN`.

## Consequences

REQ-03's drive order becomes … → secrets → release → frontend. The day-3 kill question is answered by `frontend`'s
verify: the live domain serving 200 from a deploy whose trigger was a git push.
