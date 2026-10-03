# ADR 1709 — LAU-I: verify is a probe something outside the repo answered

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a slot whose truth has no external witness

## Context

The C7 evidence asserted a directory that never existed. A verify that reads the config it just wrote proves nothing. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Self-report** — cheap / the failure mode on record.
2. **A probe** — DNS from two resolvers, TLS from a scanner, headers from the live response, a restore with matching row counts.

## Decision

Option 2. `backup` is verified only by a restore to scratch whose row counts match. The `verify-is-probe` lint fails a verify that only reads local files.

## Consequences

A backup never restored renders `unverified`, not `done`.
