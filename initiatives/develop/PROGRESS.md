# PROGRESS.md — Cycle 5 · arc-develop "The Developer"

status: LIVE
cycle: arc-develop (Cycle 5, opened 2026-08-02)
phase: 00 — in progress
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
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | pending |
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

*(empty — no phase closed yet; Phase 00 closes only via `/arc-phase-done` on green CI)*

## Now

**Current position:** Phase 00 is built and unproven-in-CI. Shipped: `.claude/scripts/develop/`
(`develop.mjs` + `ledger.mjs`), `.claude/commands/arc-develop.md`, `products/develop/manifest.json`,
`tests/develop-lifecycle.bats` (20 tests) and four fixtures. ADRs 0100–0106 are at root — develop
took the 0100 century after colliding with the model-policy session on 0063–0068.

Two findings the steel thread paid for itself with: the spine rejected develop's receipt kinds
(closed vocabulary, ADR-0026) and quarantined them **while the command still exited 0** — fixed by
ADR-0106 extending 18 → 21. And `sectionOf` shipped the exact `$`-under-`/m` bug the retro-log warns
about, caught on its first run.

**Next step:** push and let CI judge — local runs are not the gate. Last local run was 18/20; the two
failures were a missing root-mode golden (now written) and a wording mismatch on the
`all slices proven` line (now aligned to the spec). Neither has been re-run locally by design.

**Then, to close Phase 00:** CI green on all 3 legs → `/arc-develop handoff 0` → `/arc-phase-done 0`.

**Tracked, not built:** a duplicate-ADR-number check inside an existing lint, so CI catches a
forgotten century band instead of trusting the convention. Route via `/arc-change`.
