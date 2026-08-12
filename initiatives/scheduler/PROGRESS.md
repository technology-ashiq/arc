# PROGRESS.md — arc-scheduler "the heartbeat"

status: LIVE
cycle: arc-scheduler (Cycle 12, opened 2026-08-12)
phase: 01
appetite: 3d
burn: 1.0d
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
| 00 | Steel thread — `hq.jobs.yaml` + `jobs-lint` (hostile corpus + adversarial pass) + wrapper core (per-job lock, slot computation, receipts + idem@slot, git-state guard, POL-D authorization, script timeout, mock-driver delegation) + the two job scripts + `processes/` stubs + the `arc-run` refusal guard | 1.0d | ✅ done 2026-08-12 |
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
| REQ-01 | 00 | validated |
| REQ-02 | 00 | validated |
| REQ-03 | 01 | active |
| REQ-04 | 02 | active |
| REQ-05 | 03 | active |

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-08-12 | **Phase 00 CLOSED — the law, the wrapper, and 24 adversarial findings.** `hq.jobs.yaml` with a closed v1 schema parsed by the engine's own frozen subset · `jobs-lint` as a validator (exit 2 from birth, exit 1 when it cannot run at all) · `arc-jobs` wrapper walking one path, lock→guards→execute→receipt · both script-jobs · `processes/` stubs + the `arc-run` job-stub guard · the OS-scheduler fake behind a contract · REQ-01 and REQ-02 validated. **The two-surface adversarial pass returned 24 findings overlapping on ONE**, and four would have shipped: every close-day failure counted as a *sealed* day (`arc-event` exits 0 without `--strict`), `roots: ["**"]` passing the self-modification ban, a directory accepted as a script entry, and the branch already CI-red on all three legs before anyone looked. The live demo then found two more the unit tests could not: every receipt was being rejected `BAD_IDEM` while the wrapper reported `ok`, and a benign double fire was being called a lost receipt. Double fires are now *prevented*, not merely noticed | CI **31602308397, 19/19 green** at `d29fce9`, read per-JOB and head SHA confirmed equal to local HEAD · `evidence/phase-00/adversarial.md` · `evidence/phase-00/live-demo.md` · tests 0 → 66 across `jobs-lint.bats` (44), `jobs-run.bats` (14) and `jobs-contract.bats` (8) · `phase.closed` **`01KZV8SSEZX599DBG6S5H971K1`** on the canonical spine in the main clone, read back out of `events/2026-08-12.jsonl`, 0 quarantined — emitted from the main clone because `spineRoot()` refuses inside a linked worktree, and a receipt written to a worktree spine is real, valid and invisible to every reader |

## Now

**Current position, 2026-08-12: Phase 00 CLOSED, Phase 01 RUNNING.** CI green at `d29fce9`
(19/19, read per-JOB, head SHA equal to local HEAD). The owner instructed
build-through-all-phases with a single final merge at the end — no per-phase merge to `main`.
CI is the only gate; nothing is run locally.

**Two merges from `main` landed during Phase 00**, and both are worth remembering rather than
just recording. `memory` closed, `bench` was born and pushed four slices, and memory's retro
promoted `appetite-sum` out of TRIAL — a gate going live under a running lane's feet, which was
read rather than assumed (it makes only the over-commit branch fail; this lane allocates 2.75 of
3 days, so it warns and passes). The second merge is why a fix commit appeared to sit unbuilt:
the PR had gone `CONFLICTING` and GitHub triggered no run at all, which `gh run list` cannot
tell you and `gh pr view --json mergeable` can.

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

**Next step:** Phase 01 — the attended heartbeat. `catchup`, `list --next 7`, the read-only
SessionStart nudge, and the brief jobs panel whose derivation is already written and parked
(`derivePanel` is a pure function of date, jobs and events, with `Date.now()` absent rather
than merely discouraged — the `--date D` replay has to be byte-identical on every leg).

**Owner actions: none outstanding.** The `hq.policy.yaml` rows were applied on 2026-08-12, so
`jobs-lint` is clean and `birth-rule` reports 0 ungoverned.

**WIP note (informational, ADR-0052 — never a gate):** the WIP line printed `1 counted` but the
true figure is **2** — `leads` (phase 03) and `memory` (Cycle 11, phase 02, opened 2026-08-11,
burn 2.75/5d). `memory` is invisible to `wip-line.sh` because its tracker lives on an unmerged
branch, so the counter can only ever see lanes in the current worktree. Opening `scheduler`
makes it 3 against a guideline of 2.
