# PROGRESS.md — Cycle 8 · arc-engine "Governed Fallback"

status: LIVE
cycle: arc-engine (Cycle 8, opened 2026-10-07)
phase: 09
appetite: 3d
burn: 0.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 7 is archived at `archive/PLAN-cycle7-2026-10-07.md` and `archive/PROGRESS-cycle7-2026-10-07.md`
> (its full done-log and every out-of-cycle entry live there); Cycle 6 beside it. This cycle claims **ADR 0228**.
> Design source: `docs/strategy/plans/PLAN-engine-process-layer.md` § Amendment 1 (ENG-H).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — **parked, shipped in Cycle 6** | — | ✅ done 2026-08-03 |
| 09 | Steel thread for ENG-H — classifier, `nextHop`, sidecar class, mock replay, hop record, invariants (a)(b)(d) + mutant | 1.25 days | in progress |
| 10 | Chain terms at load, refuse-before-spend (invariant c), real-driver declarations, attack, close | 1.25 days | pending |

**Appetite burn: 0.5 of 3 days used (17%)** — set 2026-10-07: the `/arc-change` routing, the design-source
amendment and this kickoff, one session. Phases allocate 2.5 of 3 (83%). Kill checkpoint at 1.5 days: Phase 09 not
done → scope cut (REQ-11's claude-code/codex declarations stay `unknown`).

## Done log

- 2026-10-07 — `/arc-kickoff --lane engine`, Tier S. Cycle 7 archived; `PLAN.md`, phase specs 09–10 and
  **ADR-0228** written. Design source amended first (§ Amendment 1, commit `0bda9a51`).
  - **Owner instruction (2026-10-07):** finish every phase, do not wait, push permitted, ask only when truly blocked,
    tests on CI only. The plan-approval gate is treated as given in-session; its spine receipts (`kickoff.done` +
    `approval.requested` → `decision.recorded`) cannot be emitted from a worktree and are owed to the main clone
    after the merge.
  - **Survey done in-session** against `main` @ `9864ee29` (no separate surveyor agent — every line of PLAN
    `## Current state` was read in the source this session). Blast radius counted: 14 fixture-router writers,
    24 real-router copies, 23 `run.completed` readers.
  - **A contradiction caught before it shipped:** the amendment first filed the capped key's 403 under
    `policy-refusal`; `drivers/hermes` already maps it to BUDGET_DECLINED (ADR-0213, fixture 10). Corrected to
    `budget` in the design source and ADR-0228 — it never hops either way, but the receipt would have disagreed
    with the driver.
  - **Forks F1–F4 resolved inside ADR-0228 with the recommendations** (all two-way doors; none reached the owner).

## Now

**Position:** Phase 09 open on branch `feat/engine-failure-classifier` (worktree `arc-engine-change`, **not merged
yet** — invisible in the face until merge + pull). **Next:** build `failure-class.mjs` + the probe, wire arc-run,
push once, read CI per job in the background.

**Owed to the main clone after merge:** `kickoff.done`, the plan `approval.requested` and its `decision.recorded`,
and each phase's `phase.closed`.
