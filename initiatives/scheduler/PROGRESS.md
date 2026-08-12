# PROGRESS.md — arc-scheduler "the heartbeat"

status: LIVE
cycle: arc-scheduler (Cycle 12, opened 2026-08-12)
phase: 02
appetite: 3d
burn: 1.5d
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
| 01 | The attended heartbeat — `run` / `catchup` / `list --next 7`, read-only SessionStart nudge, deterministic brief jobs panel with overdue needs-you | 0.5d | ✅ done 2026-08-12 |
| 02 | The cron flip — `register`/`unregister` with ADR-0803's five explicit settings, next-minute smoke, fail-closed policy gate, rehearsed off-switch | 0.75d | ⬜ pending |
| 03 | Proving week + retro — ≥2 jobs unattended ≥7d, zero manual starts by actor query, fire-drill, gap audit, metric pack, `/arc-retro` | 0.5d | ⬜ pending |

**Appetite burn: 1.5 of 3 days used (50%).** Phases allocate **2.75 of 3 days; 0.25 days reserved
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
| REQ-03 | 01 | validated |
| REQ-04 | 02 | active |
| REQ-05 | 03 | active |

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-08-12 | **Phase 00 CLOSED — the law, the wrapper, and 24 adversarial findings.** `hq.jobs.yaml` with a closed v1 schema parsed by the engine's own frozen subset · `jobs-lint` as a validator (exit 2 from birth, exit 1 when it cannot run at all) · `arc-jobs` wrapper walking one path, lock→guards→execute→receipt · both script-jobs · `processes/` stubs + the `arc-run` job-stub guard · the OS-scheduler fake behind a contract · REQ-01 and REQ-02 validated. **The two-surface adversarial pass returned 24 findings overlapping on ONE**, and four would have shipped: every close-day failure counted as a *sealed* day (`arc-event` exits 0 without `--strict`), `roots: ["**"]` passing the self-modification ban, a directory accepted as a script entry, and the branch already CI-red on all three legs before anyone looked. The live demo then found two more the unit tests could not: every receipt was being rejected `BAD_IDEM` while the wrapper reported `ok`, and a benign double fire was being called a lost receipt. Double fires are now *prevented*, not merely noticed | CI **31602308397, 19/19 green** at `d29fce9`, read per-JOB and head SHA confirmed equal to local HEAD · `evidence/phase-00/adversarial.md` · `evidence/phase-00/live-demo.md` · tests 0 → 66 across `jobs-lint.bats` (44), `jobs-run.bats` (14) and `jobs-contract.bats` (8) · `phase.closed` **`01KZV8SSEZX599DBG6S5H971K1`** on the canonical spine in the main clone, read back out of `events/2026-08-12.jsonl`, 0 quarantined — emitted from the main clone because `spineRoot()` refuses inside a linked worktree, and a receipt written to a worktree spine is real, valid and invisible to every reader |
| 2026-08-12 | **Phase 01 CLOSED — silence became visible.** The jobs panel, `catchup`, `list --next 7`, and the SessionStart nudge. REQ-03 validated. The panel is a DERIVATION, not a query: a job that dies emits nothing, so there is no receipt to read and no kind to subscribe to. `derivePanel` is pure — `Date.now()` is absent rather than discouraged, because `--date D` is a replay that must stay byte-identical forever. **The hard case was the job that has NEVER run, and the first version got it wrong in the worst direction:** anchoring the count at the last slot reported exactly one missed slot forever, so a job that had never fired in a month read identically to one registered an hour ago — the detector reporting health for the loudest failure it exists to catch. It now measures over the window the SPINE CAN WITNESS, which is also what keeps a healthy schedule from writing anything into the brief and disturbing another lane's pinned golden | CI **31622464864** at `81e2392` — every scheduler test green, verified by name in the run log (panel replay, disabled-never-overdue, double-fire prevention, catchup idempotence, delegate argv, brief integration). **The run is RED on one arc-scan test that is not this lane's**, and that was proven rather than assumed: a `workflow_dispatch` control run on unchanged `main` (**31622490938**) fails the SAME arc-scan tests, three of them, where this branch fails one. `evidence/phase-01/` · tests 66 → 79 |

## Now

**Current position, 2026-08-12: Phases 00 and 01 CLOSED, Phase 02 RUNNING.** Burn 1.5 of 3 days.
The owner instructed build-through-all-phases with a single final merge at the end — no per-phase
merge to `main`. CI is the only gate; nothing is run locally.

**THE REPO HAS AN EXTERNAL RED, AND IT IS NOT THIS LANE'S.** Three `arc-scan` tests fail because
opengrep on the runner has stopped flagging the planted `eval()` — the log shows the scan RUNNING
("scanned 1 file(s) via opengrep") and simply producing no error-severity finding, which fails
`normalize` directly and then the two e2e tests that need a finding to exist. This was not
assumed: a `workflow_dispatch` control run on **unchanged main** (31622490938) fails the same
three. Both alternative explanations were checked and ruled out first — shard reshuffling cannot
be it, because ubuntu is unsharded and fails on all three Node versions; and this lane has not
touched arc-scan, semgrep or any scanner config.

Two consequences, and they are different. This lane's phases close on their OWN tests being green
on CI, which they are, asserted by name in the run log rather than by a green tick. But the FINAL
MERGE needs a green run, so it is blocked on that external breakage until whoever owns arc-scan
fixes it. The underlying defect is worth routing rather than waiting on: the test guards on
`_arc_need_semgrep` and then depends on the scanner's RULESET still matching a specific pattern,
which is a different and much more fragile claim than "a scanner is installed".

**Next step:** Phase 02 — the cron flip. `register`/`unregister` against the real Windows Task
Scheduler with ADR-0803's six settings written explicitly, the next-minute smoke, the fail-closed
policy gate, and the rehearsed off-switch. The interface and its fake already exist and are
contract-tested from Phase 00; Phase 02 puts the real implementation behind the same contract.

**Owner action outstanding, ONE, not blocking today:** copy
`docs/owner-paste-sessionstart-jobs-nudge.sh` to `.claude/hooks/SessionStart.d/60-jobs.sh`.
`.claude/hooks/**` is refused by both `ungrantable_resources` and `permissions.deny`, and that is
the rule working: a hook runs on every session start, so an agent that could write one could
arrange to run anything, forever, unattended.

**WIP note (informational, ADR-0052 — never a gate):** four lanes are live as of 2026-08-12 —
`leads`, `bench`, `engine` and this one — against a guideline of 2. `wip-line.sh` cannot see all
of them: it reads only the current worktree, so a lane on an unmerged branch is invisible to it.
