# design — history index

> **Links, never copies (ADR-0058).** Everything below lives at its original frozen path
> and stays there: `docs/archive/**` and `docs/evidence/**` are the SOLE canonical copy of
> pre-portfolio history. Two copies of an immutable record means the record is no longer
> immutable, so this file resolves to history instead of holding it. A lane-local
> `archive/` here would only ever hold cycles closed AFTER portfolio adoption.

## Cycle 3 · arc-design "The Designer" — CLOSED 2026-07-30

Vision-based design review that judges rendered pixels rather than reports about them:
a read-only critic, a four-contract brief, thesis-driven exploration with blind ranking,
and a prediction ledger. Closed with exit criterion 3 dropped by owner decision.

| What | Where (frozen) |
|---|---|
| Plan (scope truth at close) | [`docs/archive/PLAN-2026-07-30.md`](../../docs/archive/PLAN-2026-07-30.md) |
| Progress tracker (operational truth at close) | [`docs/archive/PROGRESS-2026-07-30.md`](../../docs/archive/PROGRESS-2026-07-30.md) |
| Phase specs 00–03 | [`docs/archive/phases-design-2026-07-30/`](../../docs/archive/phases-design-2026-07-30/) |
| Phase-02 evidence bundle (the one its own tracker cites) | [`docs/evidence/phase-02/`](../../docs/evidence/phase-02/) |
| Working artifacts — briefs, critiques, explore runs, blind test, library | [`docs/design/`](../../docs/design/) |
| Decisions ADR-0034…0049 | [`docs/adr/`](../../docs/adr/) |

Phases: 00 steel thread (1.25d) · 01 brief mode + design-lint v0 (1d) · 02 explore →
three isolated variants → blind ranking (1.5d) · 03 intelligence library + LexOS pilot
(0.75d).

## Why this lane exists with no live plan

`initiatives/design/` is the one permitted pre-scaffold (ADR-0058): its history already
existed when lanes were introduced, so the folder was created to give that history an
address. The lane is **IDLE** — no cycle is running, and it is not counted toward WIP.
A new design cycle starts the same way every lane starts, at `/arc-kickoff --lane design`.

Company-level records are never per-lane (ADR-0053): ADRs, `docs/HISTORY.md`, the
retro-log, the trial ledger and the test suite stay at the repo root for every lane.
