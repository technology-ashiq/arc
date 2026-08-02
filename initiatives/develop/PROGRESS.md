# PROGRESS.md — Cycle 5 · arc-develop "The Developer"

status: QUEUED
cycle: arc-develop (Cycle 5, opened 2026-08-02)
phase: 00 — planned, not started
appetite: 5d
burn: 0d
blocked-on: owner — plan approval
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane develop` on 2026-08-02 — arc's first natively-born
> lane. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at
> root and are never copied here (ADR-0053); evidence is lane-scoped from Phase 00 forward
> (ADR-0055), at `initiatives/develop/evidence/phase-NN/`.
> Design source: `docs/strategy/plans/PLAN-develop.md` (frozen — the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | pending |
| 01 | The proof floor — `develop-lint` with structural BLOCKs, evidence tiers, and a parser that survives ≥20 adversarial breaking inputs | 1.25 days | pending |
| 02 | Earned judgment — predictions scored at handoff, and a fresh unanchored `spec-fidelity` pass over spec + diff | 0.75 days | pending |
| 03 | Controlled escalation — stuck backstops, inline risk-triggered checkpoints, debt-ledger marker lint | 0.5 days | pending |

**Appetite burn: 0 of 5 days used (0%).** Phases allocate 4.0 days; the remaining 1.0 day is
deliberate slack, because Cycle 4 closed at 112% with none. The 50% tripwire is 2.5 days: if Phase 01
is not done by then, the pre-decided cut is Phase 03 in full.

## Done log

*(empty — no phase closed yet)*

## Now

**Current position:** the plan is written and awaits Ashiq's approval. `initiatives/develop/` holds
`PLAN.md`, `PROGRESS.md` and four phase specs; ADRs 0063–0068 are at root. No product code exists —
there is no `.claude/scripts/develop/`, no `.claude/commands/arc-develop.md`, no
`products/develop/manifest.json`.

**Next step:** approve the plan (the kickoff STOP gate — the approval request is on the spine as an
`approval.requested` receipt). Once approved, Phase 00 starts with its red-first test:
`bash tests/develop-lifecycle.bats` must fail with `Cannot find module
'.claude/scripts/develop/develop.mjs'` before a line of it is written.
