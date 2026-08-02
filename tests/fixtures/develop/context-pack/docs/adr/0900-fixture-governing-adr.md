# ADR 0900 — the fixture's governing decision

**Status:** accepted
**Date:** 2026-08-03
**Product:** `develop`

## Decision

Auth tokens are verified once, at the edge. This ADR deliberately cites ADR-0901 in its own
prose so that a transitive walk would pull ADR-0901 into the pack. One hop must not.
