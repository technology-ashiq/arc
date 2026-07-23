# ADR 0029 — SPINE-F: Immutability windows — active day append-only, closed day immutable forever

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** one-way
**Revisit trigger:** a compliance/leak event requires destroying data inside a closed day
(e.g. a secret that survived redaction) → new ADR defining an explicit re-close procedure
(rewrite + fresh `day.closed` sha + a `note.logged` audit trail); absent that trigger,
closed days are never rewritten.

## Context

"Replayable from receipts" (the cycle goal) is only true if history cannot drift. The attic
decision (ADR-0023, "registry is not ownership" — never delete) set the same stance for the
mold; the spine extends it to runtime truth.

## Options considered

1. **Active day append-only; closed day immutable forever; corrections via `supersedes`** — chosen.
2. **Mutable log with edit tooling** — rejected: destroys replay determinism (REQ-04) and
   every audit property the spine exists for.
3. **Full hash chaining (each event chains the previous)** — rejected as no-go: per-event
   `sha` + day-close file sha is the honest threat model here; chains add ceremony, not safety,
   for a single-writer local log.

## Decision

Immutability windows: the ACTIVE day's file is append-only; a CLOSED day is immutable
forever — `day.closed` carries the file's sha, pinning it. Corrections happen only by
appending a superseding event (`supersedes: <id>`); nothing is edited or deleted, ever.

## Consequences

- Replay and cross-day idempotency (REQ-03's cross-day dedupe) can trust file contents.
- Consumers must resolve `supersedes` when deriving state — a reader-lib concern (ADR-0030),
  written once.
- Retention is additive-only; disk cost is accepted (JSONL text, one owner, trivial volume).
