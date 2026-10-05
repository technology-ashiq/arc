# ADR 1728 — `environments` proves preview-per-PR by opening one tagged PR

**Status:** accepted
**Date:** 2026-10-05
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture whose repo forbids PRs from launch's token, or a hosting provider whose previews are not per branch

## Context

The `environments` exit criterion is "preview URL per PR". A preview exists only after someone opens a PR, and no
earlier slot does: `hosting` and `ci` commit straight to `main` (ADR-1726, ADR-1727). The `vercel-environments` row could
read Vercel and nothing else, so its verify had nothing to find on a fresh venture.

## Options considered

1. **Wait for the owner's first real PR** — no extra writes / the slot stays pending for an unknown time and the board
   cannot close (REQ-05).
2. **The adapter opens one PR of its own** — the board closes on its own evidence / one branch and one PR in the repo.

## Decision

Option 2. `environments` creates branch `arc/preview-check` from `main`, commits one file `.arc/preview-check.md` on it
with its `Arc-Launch-Tag` trailer, and opens a PR to `main` titled "arc launch: preview check". It never merges it. The
row gains `api.github.com` and `GITHUB_TOKEN`. verify asks Vercel for a READY deployment of the branch head that is not a
production deployment, with a URL, and names it.

## Consequences

The PR stays open as a standing preview probe; the weekly `verify --all` (REQ-10) re-reads it. A branch or PR of that
name launch did not create is refused, never reused. The exit plan closes the PR and deletes the branch.
