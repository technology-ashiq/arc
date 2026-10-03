# ADR 1719 — LAU-S: the adapter trust boundary is in the schema and enforced at run time

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** an adapter that needs a host or write path the schema cannot express

## Context

External review finding 8: `hosts[]` was in lint prose and missing from the registry shape; adapters could call any API and write any file. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Trust by review** — cheap / unenforced.
2. **`hosts[] · digest · credentials.scope · sensitive_actions[]` on every row, enforced by `ctx`**.

## Decision

Option 2. `ctx.fetch` refuses a host not in `hosts[]`; `ctx.write` refuses a path outside the venture repo root; a digest mismatch at load flips the row to `candidate` and refuses to run; every `sensitive_actions[]` entry emits `approval.requested` and pauses first.

## Consequences

A one-byte adapter edit un-vets it until re-vetted.
## Amendment (kickoff attack, 2026-10-03)

The digest is sha256 over the adapter bytes after CRLF→LF normalisation. **What the transform destroys:** a change
that only flips line endings is invisible to the pin. That is the intended loss — Windows checkouts convert line
endings, and a raw-byte digest would un-vet every adapter on one CI leg only. Every other byte change still flips
the row to `candidate`.
