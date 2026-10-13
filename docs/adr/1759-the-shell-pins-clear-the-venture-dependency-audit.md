# ADR 1759 — the shell's pins clear the venture's dependency audit

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a Next.js release that pins a postcss with no open high advisory (the override can go), or a new high advisory on any pin

## Context

`dependency-scan` on `arc-sandbox` went red on 2026-10-14. `npm audit --audit-level=high` named two packages:

- drizzle-orm 0.44.5: SQL injection through escaped identifiers (GHSA-gpj5-g38j-94v9, fixed in 0.45.2);
- postcss 8.4.31, which next 15.5.27 pins exactly: an XSS in its stringifier (GHSA-qx2v-qp2m-jg93), plus three source-map file reads (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp, the last fixed in 8.5.23).

The gate did its job. The fix belongs in the one manifest `frontend` writes (ADR-1733).

## Decision

The shell's `package.json` pins drizzle-orm 0.45.4, and adds `overrides: { postcss: "8.5.23" }`, so npm resolves Next's
exact pin to the patched release. It keeps Next on 15.5.27; a major-version move is not a security fix. On arc-sandbox
the already-verified `frontend` slot was re-applied with `apply --again` (ADR-1760), and the venture's audit run
went green.

## Consequences

Every new venture starts clean on the dependency gate. The override is pinned, not ranged, so a later postcss
advisory shows up on the gate instead of being absorbed silently.
