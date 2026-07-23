# ADR 0028 — SPINE-E: Secret redaction at emit, fail-safe, stub-only

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** one-way
**Revisit trigger:** quarantine/`redaction.applied` review during Phase-4 dogfood shows a
false-positive rate that costs real payloads (legitimate payloads dropped repeatedly in a
week) → tune deny-patterns via a new ADR. The fail-safe direction itself (drop, never
fail-open) does not flip: payloads already dropped are unrecoverable, and weakening later
cannot un-leak a secret.

## Context

The spine is append-only and closed days are immutable forever (ADR-0029) — a secret that
reaches the spine can never be deleted, only superseded, and the raw line still exists.
Prevention must therefore happen at emit time and must not depend on the scanner working.

## Options considered

1. **Redact at emit; scanner failure → payload dropped, stub-only marker event** — chosen.
2. **Redact at read time** — rejected: the secret is already on disk in truth; every future
   consumer and backup carries it.
3. **Fail-open on scanner error (emit unredacted, warn)** — rejected: the single worst
   outcome for an immutable log; violates "no secrets on the spine" non-negotiable.

## Decision

Secret redaction runs at emit, fail-safe, with two distinct paths (aligned with REQ-02's
per-fixture contract):

- **Deny-pattern HIT** — the input is refused: strict mode exits 2; hook mode drops the
  payload, prints a loud SKIP, exits 0, and the quarantine record for THIS class is
  **stub-only** (unlike other invalid inputs, the secret bytes are never persisted — not
  to the spine, not to `events/_quarantine/`).
- **Scanner FAILURE** (scan cannot complete) — the payload is DROPPED and a **stub-only**
  `redaction.applied` event is written — no field names, no values, no lengths.

Either way the event stream records THAT redaction happened, never what was redacted, and
no secret material survives on disk.

**Evidence:** gitleaks-class deny patterns are already in the toolchain; council v2+v3 found
43 real holes in code that looked correct — parser-class code (which the scanner is) gets
the adversarial pass before FAIL-mode trust (`docs/retro-log.md`). **Confidence:** high on
direction; medium on pattern completeness — hence secret-in-payload is a pinned hostile
fixture from Phase 0-A.

## Consequences

- A scanner bug costs data (dropped payloads), never leaks — the acceptable failure mode.
- `redaction.applied` volume is observable in the brief/gap audit, so silent over-dropping
  is caught during dogfood (REQ-07).
- Emitter overhead includes the scan — measured in Phase 1 (<1s or async, assumptions ledger).
