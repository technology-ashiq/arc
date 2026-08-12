# PROGRESS.md — arc-scheduler "the heartbeat"

status: LIVE
cycle: arc-scheduler (Cycle 12, opened 2026-08-12)
phase: 00
appetite: 3d
burn: 0.0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane scheduler` on 2026-08-12 and claims **ADR band
> 0800–0899** (ADR-0800 — *not* the 0700s `PORTFOLIO.md` advertises; `memory` holds those
> unmerged). Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`,
> `tests/`) stay at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/scheduler/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-scheduler.md` v1.0 (frozen — the decision record,
> not the cycle). SCH-A..SCH-L are locked there; §13's five opens were resolved at kickoff as
> ADR-0800/0801/0802/0804/0806.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `hq.jobs.yaml` + `jobs-lint` (hostile corpus + adversarial pass) + wrapper core (per-job lock, slot computation, receipts + idem@slot, git-state guard, POL-D authorization, script timeout, mock-driver delegation) + the two job scripts + `processes/` stubs + the `arc-run` refusal guard | 1.0d | ⬜ pending |
| 01 | The attended heartbeat — `run` / `catchup` / `list --next 7`, read-only SessionStart nudge, deterministic brief jobs panel with overdue needs-you | 0.5d | ⬜ pending |
| 02 | The cron flip — `register`/`unregister` with ADR-0803's five explicit settings, next-minute smoke, fail-closed policy gate, rehearsed off-switch | 0.75d | ⬜ pending |
| 03 | Proving week + retro — ≥2 jobs unattended ≥7d, zero manual starts by actor query, fire-drill, gap audit, metric pack, `/arc-retro` | 0.5d | ⬜ pending |

**Appetite burn: 0.0 of 3 days used (0%).** Phases allocate **2.75 of 3 days; 0.25 days reserved
for Phase 0 adversarial rework** — named, not spare. The reserve exists because this repo's own
equivalent passes returned 43 and 77 real holes against gates that passed their own tests, and
budgeting the pass without budgeting the fixing of what it finds budgets a ceremony. Phase 2 went
1.0 → 0.75 on evidence: ADR-0803 retired both of its live unknowns with citations. The proving
week is 0.5d of effort against ≥7d elapsed — elapsed is not burn.

## REQ status

| REQ | Phase | Status |
|---|---|---|
| REQ-01 | 00 | active |
| REQ-02 | 00 | active |
| REQ-03 | 01 | active |
| REQ-04 | 02 | active |
| REQ-05 | 03 | active |

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| — | nothing yet | — |

## Now

**Current position, 2026-08-12: kickoff APPROVED (`01KZTCFG2DZQJ6EE2WP1RX8P1G`), Phase 00
RUNNING.** The owner approved the plan and instructed build-through-all-phases with a single
final merge at the end — no per-phase merge to `main`. CI is the only gate; nothing is run
locally.

The plan, seven ADRs (0800–0806) and four phase specs are written. Five mandated verifications
ran before any of it, and three came back stale or wrong — the century the board offered is
already spent, the policy caveat the design source carried is resolved, and the receipt the
kickoff instruction told me to cite does not exist. One unplanned finding is larger than all
three: the design source's `policy_kind` field could not be built as specified, and ADR-0802
records the owner's chosen route around it.

**Done at approval, 2026-08-12:** `PORTFOLIO.md` corrected (a `memory` board row that was
missing entirely, a `scheduler` row, and the band table 0700s→`memory` / 0800s→`scheduler` /
0900s→next) · `docs/owner-paste-hq-policy-scheduler.yaml` generated from the live policy file,
base verified byte-identical, two `process:` job rows appended.

**Next step:** build `jobs-lint` against its hostile corpus BEFORE the wrapper, because the
parser is the surface that gets attacked — and the two-surface adversarial pass gates that
commit rather than the phase close.

**The one owner action still owed:** apply `docs/owner-paste-hq-policy-scheduler.yaml` over
`hq.policy.yaml`. That file is agent-denied by both `permissions.deny` and
`ungrantable_resources`, so it cannot be written from a session. **Apply it only after the two
`processes/*.process.yaml` stubs are on the tree** — `policy-lint` FAILs a row naming a process
that does not exist. Until it is applied, `authorizeRun` returns an L0 denial for both jobs and
Phase 00 cannot close.

**WIP note (informational, ADR-0052 — never a gate):** the WIP line printed `1 counted` but the
true figure is **2** — `leads` (phase 03) and `memory` (Cycle 11, phase 02, opened 2026-08-11,
burn 2.75/5d). `memory` is invisible to `wip-line.sh` because its tracker lives on an unmerged
branch, so the counter can only ever see lanes in the current worktree. Opening `scheduler`
makes it 3 against a guideline of 2.
