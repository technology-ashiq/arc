# ADR 1715 — LAU-O: adapters live inside arc and import no package

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** the first adapter whose provider cannot be reached by `fetch` or its CLI

## Context

LAU-O was left open by design. Dependency read on 2026-10-03: every core initial candidate exposes a REST API reachable by Node's built-in `fetch` — Cloudflare (DNS), GitHub (`gh` CLI, logged in with `repo` scope), Vercel (REST + CLI), Supabase (Management API + CLI, logged in), Resend, Razorpay, Sentry. None needs an SDK. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **(a) `products/launch/providers/<slot>/<name>.mjs` inside arc** — one PR proves REQ-08; digest pin is a file hash / adapters ship with the OS repo.
2. **(b) a separate `arc-launch-providers` repo pinned by digest** — no SDK can enter the zero-dep repo / two repos, cross-repo CI, REQ-08's one-PR file-list check becomes two PRs.

## Decision

Option (a). Adapters import only `node:` built-ins and the lane's own `ctx`; the `zero-dep-leg` lint fails any adapter that imports a package, and stays on after this decision as the guard that keeps (a) honest.

## Consequences

If the trigger fires, that one adapter moves to (b) and its digest is re-pinned at the move; the rest stay.
