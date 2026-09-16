# ADR 1322 — FV2-E: council renders `--accent-dim`; violet stays the non-real family alone

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner scores a council screen BELOW the reference specifically on the council colour → re-open collision #2 in `docs/design/system/tokens.css` with a computed contrast note, by new ADR.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-E — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. Keeps `tokens.css` collision #2 and ADR-1313 (honesty classes never mixed).

## Context

v0.7 renders `violet` for council AND for simulated. `tokens.css` already adjudicated this as
collision #2: a screen carrying both makes a real council verdict read as simulated.

## Options considered

1. **Keep the token law: council → `--accent-dim`, violet → non-real family only.**
2. **Follow the reference: violet for both** — rejected in PLAN-face-v2 §10; mixes real and simulated classes (ADR-1313).

## Decision

Option 1. The reference is the target, the contract is the law, and the token file is where
they are made to agree — as SOURCE.md already recorded for the v0.4 intake.

## Consequences

- The per-room shot review for REQ-01 accepts this as a declared, intentional delta from the v0.7 baseline, not a fidelity miss.
