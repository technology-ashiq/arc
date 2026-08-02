# PROGRESS.md — Cycle 5 · arc-develop "The Developer"

status: LIVE
cycle: arc-develop (Cycle 5, opened 2026-08-02)
phase: 01 — in progress
appetite: 5d
burn: 0.5d
blocked-on: —
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
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | ✅ done 2026-08-02 |
| 01 | The proof floor — `develop-lint` with structural BLOCKs, evidence tiers, and a parser that survives ≥20 adversarial breaking inputs | 1.25 days | pending |
| 02 | Earned judgment — predictions scored at handoff, and a fresh unanchored `spec-fidelity` pass over spec + diff | 0.75 days | pending |
| 03 | Controlled escalation — stuck backstops, inline risk-triggered checkpoints, debt-ledger marker lint | 0.5 days | pending |

**Appetite burn: ~0.5 of 5 days used (~10%).** Phases allocate 4.0 days; the remaining 1.0 day is
deliberate slack, because Cycle 4 closed at 112% with none. The checkpoint is 3.0 days: if Phase 01
is not done by then, the pre-decided cut is Phase 03 in full. (A literal 50% mark would have been a
broken instrument — Phase 00 + 01 already sum to 2.75d, so it would fire on every on-schedule run.)

Basis for the ~0.5d, so it can be audited rather than believed: one unbroken sitting on 2026-08-02
covering the kickoff (plan, 4 specs, 6 ADRs, 3 attack rounds, 3 simulation rounds), the ADR-band
repair, and Phase 00's implementation through to 18 of 20 tests passing locally.

## Done log

**Phase 00 — steel thread — closed 2026-08-02, ~0.5d against a 1.5d appetite.**
CI run `30751546128` green: 20 of 20 jobs, ubuntu + macos + windows, head `8c46844`
(`initiatives/develop/evidence/phase-00/ci-green.txt`). `/arc-develop` runs
start → next → status → checkpoint → handoff offline against committed fixtures; the lane
contract holds (unknown lane exits 4, duplicate `--lane` exits 5, reserved names exit 5, root-mode
byte-identical to its golden); receipts land; `status` reconstructs cold at `slice 2/5`.

Under appetite because the phase found its two hard problems early rather than late:

1. **The spine silently swallowed every receipt.** Its kind vocabulary is closed (ADR-0026) and
   `develop.started` was quarantined with `UNKNOWN_KIND` **while the command still exited 0** —
   a receipt that never landed, reported as success. ADR-0106 extends it 18 → 21.
2. **`sectionOf` shipped the `$`-under-`/m` bug** the retro-log records from 2026-07-16, so every
   derived brief field came back empty. Caught on its first run against a real fixture.

Two more caught by process rather than luck: a test that passed before any code existed (node's own
`Cannot find module` is also non-zero and also writes no file — it now asserts the reason), and the
ADR-number collision with the model-policy session, which forced the century-band rule.

**Phase 00 did not use `/arc-develop` on itself** — the tool did not exist yet. Phase 01 is the
first phase run through it, which is the real dogfood.

## Now

**Current position:** Phase 00 closed on green CI. Phase 01 — the proof floor — is open and is the
**first phase run through `/arc-develop` itself**, so the harness's real ledger now lives at
`initiatives/develop/phases/phase-01-tasks.md`.

Phase 01 builds `.claude/scripts/develop/develop-lint.mjs`: three structural BLOCKs
(`ledger-unparseable`, `brief-stale`, `slice-unproven`) plus two WARN-first heuristics
(`self-declared-number`, `tier-floor`), per ADR-0101. Its parser must survive ≥20 hand-built
breaking inputs before the phase can close, and every BLOCK ships with a negative control proving
it can fail.

**Next step:** work the slice ledger — `/arc-develop next`, declare each slice's proof before
writing it, paste real output, commit, repeat. Push per slice-batch; CI is the gate.

**Tracked, not built:** a duplicate-ADR-number check inside an existing lint, so CI catches a
forgotten century band instead of trusting the convention. Route via `/arc-change`.
