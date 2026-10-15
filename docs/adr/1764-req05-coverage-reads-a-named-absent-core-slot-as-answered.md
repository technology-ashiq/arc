# ADR 1764 — REQ-05's coverage clause reads a named-ABSENT core slot as answered, and says so by name

**Status:** accepted
**Date:** 2026-10-15
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a first real venture (REQ-12) reaches `domain` or `legal-pages`. Its row is then vetted through
that venture's own live run, and the exception below has no slot left to name.

## Context

REQ-05 has two clauses:
1. `verify --all` exits 0, with every core slot `verified` or a named `ABSENT({reason})`, and none `pending`.
2. `launch-coverage` reports 0 core slots with 0 vetted providers.

A row is vetted only through a passing real verify, a scout record and the owner's `decision.recorded` (ADR-1705).
`arc-sandbox` holds three named ABSENTs (2026-10-15 board, `evidence/phase-05/board.md`):
- `domain`: rehearsal never crosses gate 1 (approval.requested 01M4S0GYX6S3NVGA9CRSN9Z1H9, refusal exercised).
- `payment-live`: never crosses gate 3 (approval.requested 01M4VRAKRFHJJKHGPSEM6YZTA9, refusal exercised).
- `legal-pages`: the legal renderer is not ready.

`payment-live` shares its row with `payment-test`, so the scout record covers it. `domain` (`cloudflare-registrar`)
and `legal-pages` (`arc-legal`) have no other row. Their only rows cannot run live on a rehearsal without crossing the
gate the rehearsal exists to refuse, or without a renderer that does not exist. So once the owner stamps the vetting,
clause 2 reads 2 of 34, never 0.

Each way to make it read 0 breaks a non-negotiable:
- Vetting either row without a live verify breaks ADR-1705.
- Registering a domain from a rehearsal crosses gate 1 (ADR-1700, ADR-1720).
- Teaching `launch-coverage` to skip ABSENT slots makes the count stop measuring what it says.

## Decision

Clause 2 is read together with clause 1: a core slot that the board holds as a **named ABSENT** with a recorded
reason counts as answered for REQ-05. The Phase 05 evidence names each such slot and its reason. `launch-coverage`
does not change and keeps printing the true count. The evidence prints that count beside the named list, and the two
must agree: every core slot with zero vetted providers is a named ABSENT on the board, and no other.

REQ-05 is recorded as met with two named exceptions (`domain`, `legal-pages`), not as met outright.

## Consequences

- No gate is weakened. The coverage count stays a measurement, and the exception lives in evidence a reader can check
  against the board.
- A third zero-vetted core slot that is not a named ABSENT still fails REQ-05.
- Cycle 2 owns the two rows: `legal-pages` once the renderer ships, `domain` on the first real venture's gate-1 crossing.
