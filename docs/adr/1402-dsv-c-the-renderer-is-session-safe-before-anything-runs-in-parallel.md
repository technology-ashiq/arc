# ADR 1402 — DSV-C: the renderer is session-safe before anything runs in parallel

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a concurrent-render defect appears from a caller that passed `--session`
correctly — the isolation unit is then wrong, not the flag.

## Context

`.claude/scripts/design/design-render.sh` hardcodes `SESSION="design-critic"` (L62). The
comment above it explains why the value is fixed: *so a critique render never inherits
cookies, viewport or a stale page from somebody's QA session.* That reasoning is sound and
must survive — the defect is not that the session is fixed, it is that it is **shared**.
Three composers rendering at once through one browser session race each other.

[ADR-1401](1401-dsv-b-the-composer-sees-its-own-work.md) makes concurrent rendering the
normal case, so this is load-bearing before anything composes in parallel.

## Options considered

1. **Serialise all renders behind a lock** — pros: no interface change / cons: turns an
   explore into a queue and hides the race rather than removing it.
2. **`--session <id>` mandatory in explore mode; unique per run+variant** — pros: real
   isolation, and the absence of the flag can refuse rather than silently default / cons:
   every caller must be updated.

## Decision

Option 2. `--session <id>` becomes **mandatory in explore mode**; its absence refuses with a
message and never falls back to a default. The critique path keeps its named session, so the
existing isolation-from-QA property is preserved rather than traded away.

Acceptance is a test, not a promise: **3 concurrent renders, each producing its own route's
correct stable hash.**

Cross-OS hash equality is explicitly **out of contract**. `PIN_FONT=0` is the default by owner
decision (2026-07-30) so typography is judged as designed; per-platform internal stability is
the only honest guarantee, and demanding more manufactures false failures.

## Consequences

Easier: parallel composers, and a missing session is a loud refusal instead of a silent
collision. Harder: every existing caller of `design-render.sh` must be found and updated —
mechanically, by listing callers, not from memory, because this repo has now left a twin fix
unapplied three times in one cycle.
