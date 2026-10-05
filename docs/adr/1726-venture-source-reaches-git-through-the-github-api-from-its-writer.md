# ADR 1726 — Venture source reaches git through the GitHub API, committed by the adapter that writes it

**Status:** accepted
**Date:** 2026-10-05
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture whose source is too large for one Git Data API tree (GitHub caps a tree at 100,000 entries / 7 MB)

## Context

REQ-03's day-3 kill needs a deploy whose trigger is a git push. Two Phase 01 slots write venture source: `ci` (the
workflow file) and `frontend` (the Next shell). An adapter's world is `ctx` (ADR-1704): it may write under the venture
root but cannot run `git`, and the zero-dep scan refuses `child_process`. The `frontend` row (`nextjs-shell`) holds only
`sandbox.automemory.ai` in `hosts[]`, so the shell it writes could never reach the repo.

## Options considered

1. **The runner runs `git push` after a slot** — one push path / puts git and a credential in the trusted runner,
   which then holds logic no row describes.
2. **The writing adapter commits through the GitHub API** — stays inside `ctx.fetch` and the row's `hosts[]`; a ref
   update is a push event, so Vercel's git integration deploys it and Actions runs on it.

## Decision

Option 2. A writer writes each file under the venture root with `ctx.write` and commits the same bytes: one file through
the Contents API (`PUT /repos/{repo}/contents/{path}`, which carries the current blob sha, so an unchanged file is not
re-committed), several files through the Git Data API (blobs → tree → one commit → ref). The commit message carries the
trailer `Arc-Launch-Tag: <resource tag>`. The repo is read from `ctx.upstream.repo` (ADR-1725), never rebuilt from the
profile. When `frontend` is built, its row gains `api.github.com`, `www.googleapis.com` (PageSpeed, the Lighthouse
scanner) and `GITHUB_TOKEN`.

## Consequences

Adapters stay one file each (ADR-1704), so the commit code is repeated per writer rather than shared. A file the owner
edited in the venture repo is overwritten only when its content differs from what launch writes; the commit names the
tag so `git log` shows which slot wrote it.

The `ci` exit criterion asks for required checks, and GitHub Free refuses branch protection on a private repo. If the
first real `ci` apply answers 403 "Upgrade to GitHub Pro", the adapter refuses with `PLAN_LIMIT`; the owner then chooses
between a paid plan and an ADR that records `ci` as checks green on three legs with the required half
`ABSENT(plan: private-repo protection)`. It is never worked round silently.
