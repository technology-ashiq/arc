# PROGRESS.md — Cycle 5 · model-policy "Balanced Model Policy"

status: LIVE
cycle: model-policy (Cycle 5, opened 2026-08-02)
phase: 00
appetite: 3d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Design source: [`docs/strategy/plans/PLAN-model-policy.md`](../../docs/strategy/plans/PLAN-model-policy.md)
> (v2.1 FINAL, owner-approved) — an input to this cycle, never a second truth.
> Predecessor (Cycle 4 · arc-portfolio) CLOSED 2026-08-02 at ~112% appetite.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — the Balanced Model Policy ADR-0069 written (blocks a–g), linted, merged (REQ-01) | 0.5 days | ⏳ next — approved 2026-08-02, not yet started |
| 01 | Council `standard` mode + one real run; session-001 retrofit + honest grade-or-UNRESOLVED (REQ-02, REQ-04) | 0.75 days | ⏸ not started |
| 02 | Paired composer A/B at one pinned commit; blind 7-item rankings; keep/revert ADR (REQ-03) | 1.25 days | ⏸ not started |
| 03 | Attacker reject-log with fixed taxonomy (REQ-05) + mode-ladder dogfood + retro | 0.5 days | ⏸ not started |

**Appetite burn: 0 of 3 days used (0%).** Kill criteria are live from the first hour: at
**1.5d** REQ-01 unmerged → STOP, take the contested article to `/arc-council standard`,
bank nothing, retro. At **2.5d** if both REQ-03 arms cannot finish → bank the finished arm
to `BRIEF-composer-ab.md` with its receipts and drop the REQ. Never extend.

Phase appetites sum to exactly 3.0 of 3.0 days — there is no slack, by design. The two
tripwires above are the release valves.

## Done-log

*(empty — no phase has closed. `/arc-phase-done <n> --lane model-policy` writes here, and
only against the phase's own spec exit criteria.)*

## Assumptions status

| ID | Assumption | State |
|---|---|---|
| A-01 | Workhorse composer seat is a live quality bottleneck | open — tested Phase 02 |
| A-02 | A 2-researcher envelope covers a real slice of council use | open — tested Phase 01 |
| A-03 | Owner sustains ~30 min/week for calibration dogfood | open — tested Phase 03 |
| A-04 | No rupee spend threshold needed; the two event triggers suffice | open — ledgered at owner's instruction, tested Phase 00 |
| A-05 | `arc-kickoff.md` is the only surface where a finding is rejected | open — ledgered at owner's instruction, tested Phase 03 |
| A-06 | A real kickoff will run within 14 days of close to exercise the REQ-05 reject line | open — added by the attack panel; carries Phase 03's "implemented, unproven" fallback |

## Now

**Position:** kickoff complete; **plan APPROVED by the owner 2026-08-02** (spine approval
`01KZ0VF0ZN0PC1RXS43SZF1EMX`, reason "model-policy plan"). `PLAN.md`, four phase specs and
six decision ADRs (0063–0068 for MP-A..F) are written and pass `kickoff-lint` + `board-lint`.
The lane is LIVE and Phase 00 is cleared to start; no Phase-00 work has been done yet.

**What was decided without asking:** MP-A..F were locked by the owner in the design source
and are recorded as ADR-0063..0068. Two forks the fork-planner raised were, at the owner's
explicit instruction, put into the assumptions ledger with falsification triggers rather
than answered now — **A-04** (the engine trigger's ₹N spend figure, which exists nowhere in
the repo) and **A-05** (REQ-05's `/arc-change` mirror, which does not exist in
`arc-change.md` under any name).

**Next step:** Phase 00. Its first action is adding the `| 0069 | Balanced Model Policy |
accepted |` row to `PLAN.md`'s ADR index **before** the file exists, so `kickoff-lint`'s
`[adr]` group fails with `ADR 0069 in index but docs/adr/0069-*.md not found` — that red is
the proof the gate can see the policy at all. Then write
`docs/adr/0069-balanced-model-policy.md` with all seven blocks a–g to turn it green.
Appetite 0.5d; the 1.5d kill criterion is on REQ-01 specifically.
