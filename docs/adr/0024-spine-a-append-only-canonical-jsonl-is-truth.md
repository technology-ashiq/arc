# ADR 0024 — SPINE-A: Append-only canonical JSONL is truth; sqlite is an optional accelerator

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** one-way
**Revisit trigger:** JSONL-scan `arc brief` ≥5s on the owner's box against a 90-day synthetic
spine → promote the `node:sqlite` accelerator to recommended (equivalence-gated), per the
PLAN assumptions ledger. Schema evolution only via the `v` field + a new ADR — the canonical
serialization and sha definition themselves are frozen once events exist.

## Context

Cycle 2 builds the receipt spine: every factory action and every rupee as one event stream
(design source: `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md`, locked 2026-07-22).
Truth storage must be deterministic across 3-OS CI (Windows/macOS/Linux), diffable,
append-friendly, and runnable on Node ≥18 with zero dependencies (inherited non-negotiable).
Every event carries a `sha`, so the byte-level serialization is part of the contract forever.

## Options considered

1. **Append-only JSONL in canonical serialization; `node:sqlite` optional accelerator** — chosen.
2. **sqlite as truth** — rejected: `node:sqlite` needs Node 22+ (CI keeps a Node 18 leg),
   native-dep sqlite is banned (zero-dep rule), binary truth is not diffable or appendable,
   and replay-from-truth (REQ-04) becomes replay-from-derived.
3. **One file per event** — rejected: filesystem overhead, ordering ambiguity, painful
   day-close hashing.

## Decision

Append-only JSONL is truth, in **canonical serialization**: UTF-8, LF, sorted keys, no
insignificant whitespace. `sha` = SHA-256 over the canonical event excluding the sha field.
The canonical read path is a JSONL scan (works on Node ≥18 everywhere); `node:sqlite`
(Node 22+) is an optional accelerator behind an equivalence gate (sqlite-vs-scan byte-identical
output). Native-dependency sqlite is banned. Canonical serialization is defined ONCE in a
single module shared by emitter, hasher, and reader.

**Evidence:** orchestrator initiative closed on Node-18-compatible zero-dep tooling, 271/271
bats across 3 OS; Windows CRLF/locale is a known hot zone (design source, verified 2026-07-22).
**Confidence:** high.

## Consequences

- Determinism is testable: `rm state.db && arc-replay && arc brief` must be byte-identical
  to golden, twice over (with and without sqlite) — REQ-04 enters CI at Phase 0-B.
- Changing serialization later invalidates every stored sha — hence one-way, hence the
  adversarial fixture corpus (CRLF/BOM/non-UTF8) pins the format from Phase 0-A.
- Ad-hoc queries use the sqlite3 CLI against derived state, never new reader features.
