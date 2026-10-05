# ADR 1727 — Gate 2 holds production in the venture repo, through Vercel's ignored-build step

**Status:** accepted
**Date:** 2026-10-05
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a hosting provider with no ignored-build hook, or Vercel no longer recording an ignored build as a deployment

## Context

REQ-03 asks for gate 2 to be emitted and decided before the first production deploy. A Vercel project linked to a git
repo deploys `main` to production on every push, so linking the repo in `hosting` would cross gate 2 before `release`
(the gated slot) runs. `hosting`'s own exit criterion still needs a git-triggered deploy (`githubDeployment: 1`).

## Options considered

1. **Link the repo only in `release`** — gate holds / `hosting` can never show a git-triggered deploy, and `dns` (which
   needs `hosting` verified, ADR-1725) waits for the gate.
2. **A project setting (`commandForIgnoringBuildStep`)** — holds / the hold lives outside git, where `git log` cannot
   show who lifted it.
3. **`vercel.json` in the venture repo with `ignoreCommand` set to skip production** — the hold is a committed file,
   lifted by a tagged commit after the gate is decided.

## Decision

Option 3. `hosting` links the repo, then commits `vercel.json` holding `"ignoreCommand": "[ \"$VERCEL_ENV\" = production ]"`
(exit 0 skips the build) through the Contents API with its `Arc-Launch-Tag` trailer (ADR-1726). That push is the
git-triggered deployment `hosting` verifies: Vercel records it with `meta.githubDeployment = "1"` and does not build it.
`release`, after gate 2's `approval.requested` is decided, commits `vercel.json` without the hold; that push is the first
production build. The `vercel` row gains `api.github.com` and `GITHUB_TOKEN`.

## Consequences

Preview deployments build normally while production is held, so `environments` can verify a preview URL before gate 2.
An owner who deletes `vercel.json` lifts the hold by hand, and `git log` shows it.
