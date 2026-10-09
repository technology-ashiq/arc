# ADR 1747 — errors throws a known error from a committed route, reports it over Sentry's store API, and asks Sentry

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the venture adopts `@sentry/nextjs` (the route then reports through it), or Sentry retires the
store endpoint

## Context

REQ-06: "a thrown fixture error appears as a Sentry issue". The shell owns `package.json` (ADR-1733), so a later slot
cannot add an SDK. The row carried only `sentry.io`.

## Decision

- scaffold finds the Sentry project whose slug is the venture slug, across every page of the projects list:
  - none found refuses `SENTRY_PROJECT_MISSING` (the owner creates the project);
  - two found refuses `SENTRY_PROJECT_AMBIGUOUS`;
  - a project with no active client key refuses `SENTRY_NO_DSN`.

  It then commits `app/api/arc-error-probe/route.js` with that key's public DSN.
- The route accepts only `?probe=arcprobe<16 hex>`. It throws `Error("arc-launch probe <id>")`, catches it, posts the
  event to the DSN's store endpoint, and answers 500.
- verify calls the live route with the probe id derived from the tag, and requires the 500. It then asks
  `sentry.io/api/0/projects/<org>/<slug>/issues/` for an issue with that message whose `lastSeen` is no earlier than
  two minutes before this verify began. It asks up to six times, 15 s apart. The answer is Sentry's, not the route's.
- Row: `SENTRY_AUTH_TOKEN`, `GITHUB_TOKEN`; hosts are `sentry.io`, the venture domain and `api.github.com`.

## Consequences

- The probe route is public. Anyone can make it report the fixed probe message, which only bumps one issue's count
  (debt D36). A DSN is public by design.
