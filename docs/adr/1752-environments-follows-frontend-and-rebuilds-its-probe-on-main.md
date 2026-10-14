# ADR 1752 — `environments` follows `frontend` and rebuilds its probe branch on main's head

**Status:** accepted
**Date:** 2026-10-13
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a hosting provider that can prove "a preview URL per PR" without building the venture's app

## Context

The first real run on `arc-sandbox` (2026-10-13) applied `environments` straight after `hosting`, as the catalog allowed.
Its probe branch `arc/preview-check` was cut from a `main` that held no app yet, so Vercel's preview build stopped with
`NEXT_NO_VERSION` and the slot failed. The probe proves a preview *of the venture*, so it needs the app that `frontend`
commits. A second hole sat behind the first: once made, the branch never moved, so even after `frontend` landed the
re-run would have previewed the old empty commit again.

## Options considered

1. **Keep the edge; let `environments` fail until `frontend` exists** — no change / a red slot on every venture's first pass, and the stale branch never heals.
2. **`environments` depends on `frontend`; the scaffold moves a launch-owned probe branch onto main's head when main has moved** — one edge, one guarded force-move.

## Decision

Option 2. `environments.depends_on` = `hosting`, `frontend`. On a re-run whose probe branch is launch's (its head carries the
slot trailer) but whose parent is not main's head, the scaffold force-moves the branch to main and commits the probe file
again. The force-move only ever touches a branch already proven launch's; an owner's branch of that name still refuses.
A kill between the move and the commit leaves the branch at main's head with the branch recorded, which the existing
killed-after-branch path finishes.

## Consequences

REQ-03's drive order becomes repo → ci → hosting → secrets → release → frontend → environments → dns → tls → … . The
day-3 kill question is unchanged. Pinned by `launch-contract: environments moves its probe branch onto a main that gained
the app, still one PR`.
