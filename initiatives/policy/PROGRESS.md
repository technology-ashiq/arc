# PROGRESS.md — policy cycle 2 "Evidenced levels"

status: LIVE
cycle: arc-policy cycle 2 (opened 2026-10-07)
phase: 00
appetite: 3d
burn: 1.0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 9 (2026-08-06 → 2026-08-10, phases 00–04, PR #130/#147) is archived in-lane:
> `archive/PLAN-cycle9-2026-08-10.md`, `archive/PROGRESS-cycle9-2026-08-10.md`,
> `archive/phases-cycle9-2026-08-10/`, `archive/evidence-cycle9-2026-08-10/` — except
> `evidence/phase-00/hook-matrix.{json,md}`, a live generator output CI rewrites in place.
> ADR band 0500–0599 (ADR-0500); this cycle adds ADR-0509..0511.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: refusal profile + `arc-run`'s typed L0 refusal receipt → pure fold → `check` with BELOW-BAR, invariants (a)(b) + mutants | 1.25 days | 🔨 built, 2 attack rounds, PR #368 on CI |
| 01 | Guard (invariant (c)) + `/api/policy` evidence + the room's per-cell age | 0.75 days | 🔨 built, 2 attack rounds, stacked PR from `feat/policy-c2-p01` |
| 02 | Owner paste: `evidence_days`, lint key, hook's interactive receipt, `policy-lint --evidence`, deny floor | 0.5 days | ⏳ |

**Appetite burn: 1.0 of 3 days used (33%).** Under the 50% tripwire, Phase 00 built and on CI. Phases allocate 2.5 of 3 days; 0.5 days of slack.

**Tripwires:** at 1.5 days, Phase 00 not closed → face cell cut to the API field only. Phase 02
waits on the owner's paste, never on effort.

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-10-07 | Cycle 2 kickoff. Design source amended first through `/arc-change` (PLAN-policy v1.1, POL-L, PR #365). Tier S, 5 REQ, ADR-0509..0511. **Not a phase close** | `kickoff.done` `01M49X88ZWME12Y9AZC5YQ90MP` · `approval.requested` `01M49X8BNTYZRP2GHTQHQGT2ZD` (canonical spine, main clone, 0 quarantined; the stamp is the owner's) · 1 merged plan-attacker run: 7 findings, 7 accepted, 0 rejected |

## Now

**Current position: kickoff written; Phase 00 next.** The owner instructed on 2026-10-07 to run
every phase without waiting and ask only when truly blocked. So the build proceeds; the
kickoff approval request is left on the spine for the owner to stamp, and is not stamped by an
agent.

**What the kickoff decided** (no owner questions, by instruction; forks recorded as ADRs):
POL-L1 → a `note.logged` `policy.refusal` profile (ADR-0509), zero new kinds; POL-L2 → one cell
per subject × capability (ADR-0510); POL-L3 → scheduler `policy-declined` counts only with a
typed `capability` (ADR-0509); the guard is policy's own, adopting ADR-0910's rule (ADR-0511).

**The first honest reading is predicted in advance:** 17 in-scope cells (shell L1 × 11,
network L1 × 6), every one BELOW-BAR, 0 refusals. The 15 `process:*` cells read `unknown`
because a headless L1 run is not offered the tool, so no attempt exists to refuse. That is
the engine lane's to instrument, not this cycle's.

**Open with the owner (not blocking any phase):** the STOP-or-fund-the-first-headless-job
decision that Cycle 9's assumption row 1 forced when it fired (archived PLAN, row 1) · naming
the lane that owns "Gap B's Availability enum" · stamping the kickoff approval · the Phase 02
paste when it is generated.

**Next:** Phase 01 attack (round 1) on `feat/policy-c2-p01`, base `origin/feat/policy-c2-evidence`; then #368 CI per job (main was red on `PLAN-distribute` until #364), close Phase 00, then Phase 02 (the owner paste).
