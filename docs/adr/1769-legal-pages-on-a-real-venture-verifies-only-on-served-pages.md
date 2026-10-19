# ADR 1769 — On a real venture, `legal-pages` verifies only on served arc-legal pages; "renderer not ready" is a rehearsal answer

**Status:** accepted
**Date:** 2026-10-19
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the legal lane's publish path refuses a launch-scaffolded Next shell (Assumption A-12). The slot
then needs a renderer handoff ADR in the legal century, routed through `/arc-change`.

## Context

`legal-pages` is a core slot. Its only row, `arc-legal`, is a `candidate`. Its exit criterion reads "legal.publish
receipt or ABSENT: legal renderer not ready". That ABSENT was true in Cycle 1. Since legal Cycle 14 sealed (LexOS
published on real facts), the renderer exists, so on a real venture the reason would be false. Publishing a venture's
policy pages is the owner's permanent human gate (`legal.publish`, legal REQ-06), and launch never publishes.

## Decision

- `arc-legal` is vetted on `myfitfolio` in Cycle 2, through a real passing verify of served `/privacy` and `/terms`
  pages (ADR-1705).
- On a `honesty_class: real` venture, the adapter refuses to answer ABSENT and reports `failed(legal:unpublished)` until
  the pages are served. On a rehearsal, the ABSENT path is unchanged.
- The owner runs the legal lane's publish for `myfitfolio`. The facts file lives under `~/.arc-private/legal/`, never in
  git, because the arc repo is public.

## Consequences

- One owner act sits on the done line. Phase 08 names it on its first day, so it never surfaces at the close
  (retro 2026-10-15 #4).
- The adapter's bytes change, so `arc-legal` gets its digest at vetting, as every first vetting does.

**Evidence:** `products/launch/providers/legal-pages/arc-legal.mjs` header; `launch.slots.yaml:518`; ADR-1764; legal C14
seal (PR #377).
**Confidence:** medium.
