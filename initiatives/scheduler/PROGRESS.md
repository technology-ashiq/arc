# PROGRESS.md — arc-scheduler "the heartbeat"

status: LIVE
cycle: arc-scheduler (Cycle 12, opened 2026-08-12)
phase: 03
appetite: 3d
burn: 2.5d
blocked-on: elapsed time — the proving week RESTARTED 2026-08-17 (a defect made every run after the first a no-op), and the fire-drill armed 2026-08-23 needs its THIRD missed slot before the detector fires; earliest close 2026-08-26
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
> ADR-0800/0801/0802/0804/0806. The proving week then added **ADR-0807** (Windows queues at most
> one missed instance; recovery is a logon trigger) and **ADR-0808** (a gap is graded by class, not
> by absence), so the band now holds 0800–0808.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `hq.jobs.yaml` + `jobs-lint` (hostile corpus + adversarial pass) + wrapper core (per-job lock, slot computation, receipts + idem@slot, git-state guard, POL-D authorization, script timeout, mock-driver delegation) + the two job scripts + `processes/` stubs + the `arc-run` refusal guard | 1.0d | ✅ done 2026-08-12 |
| 01 | The attended heartbeat — `run` / `catchup` / `list --next 7`, read-only SessionStart nudge, deterministic brief jobs panel with overdue needs-you | 0.5d | ✅ done 2026-08-12 |
| 02 | The cron flip — `register`/`unregister` with ADR-0803's five explicit settings, next-minute smoke, fail-closed policy gate, rehearsed off-switch | 0.75d | ✅ done 2026-08-13 |
| 03 | Proving week + retro — ≥2 jobs unattended ≥7d, zero manual starts by actor query, fire-drill, gap audit, metric pack, `/arc-retro` | 0.5d | ⏳ running — clock RESTARTED 2026-08-17, fire-drill armed 2026-08-23, earliest close **2026-08-26** |

**Appetite burn: 2.5 of 3 days used (83%).** Phases allocate **2.75 of 3 days; 0.25 days reserved
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
| REQ-04 | 02 | validated |
| REQ-05 | 03 | active |

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-08-12 | **Phase 00 CLOSED — the law, the wrapper, and 24 adversarial findings.** `hq.jobs.yaml` with a closed v1 schema parsed by the engine's own frozen subset · `jobs-lint` as a validator (exit 2 from birth, exit 1 when it cannot run at all) · `arc-jobs` wrapper walking one path, lock→guards→execute→receipt · both script-jobs · `processes/` stubs + the `arc-run` job-stub guard · the OS-scheduler fake behind a contract · REQ-01 and REQ-02 validated. **The two-surface adversarial pass returned 24 findings overlapping on ONE**, and four would have shipped: every close-day failure counted as a *sealed* day (`arc-event` exits 0 without `--strict`), `roots: ["**"]` passing the self-modification ban, a directory accepted as a script entry, and the branch already CI-red on all three legs before anyone looked. The live demo then found two more the unit tests could not: every receipt was being rejected `BAD_IDEM` while the wrapper reported `ok`, and a benign double fire was being called a lost receipt. Double fires are now *prevented*, not merely noticed | CI **31602308397, 19/19 green** at `d29fce9`, read per-JOB and head SHA confirmed equal to local HEAD · `evidence/phase-00/adversarial.md` · `evidence/phase-00/live-demo.md` · tests 0 → 66 across `jobs-lint.bats` (44), `jobs-run.bats` (14) and `jobs-contract.bats` (8) · `phase.closed` **`01KZV8SSEZX599DBG6S5H971K1`** on the canonical spine in the main clone, read back out of `events/2026-08-12.jsonl`, 0 quarantined — emitted from the main clone because `spineRoot()` refuses inside a linked worktree, and a receipt written to a worktree spine is real, valid and invisible to every reader |
| 2026-08-12 | **Phase 01 CLOSED — silence became visible.** The jobs panel, `catchup`, `list --next 7`, and the SessionStart nudge. REQ-03 validated. The panel is a DERIVATION, not a query: a job that dies emits nothing, so there is no receipt to read and no kind to subscribe to. `derivePanel` is pure — `Date.now()` is absent rather than discouraged, because `--date D` is a replay that must stay byte-identical forever. **The hard case was the job that has NEVER run, and the first version got it wrong in the worst direction:** anchoring the count at the last slot reported exactly one missed slot forever, so a job that had never fired in a month read identically to one registered an hour ago — the detector reporting health for the loudest failure it exists to catch. It now measures over the window the SPINE CAN WITNESS, which is also what keeps a healthy schedule from writing anything into the brief and disturbing another lane's pinned golden | CI **31622464864** at `81e2392` — every scheduler test green, verified by name in the run log (panel replay, disabled-never-overdue, double-fire prevention, catchup idempotence, delegate argv, brief integration). **The run is RED on one arc-scan test that is not this lane's**, and that was proven rather than assumed: a `workflow_dispatch` control run on unchanged `main` (**31622490938**) fails the SAME arc-scan tests, three of them, where this branch fails one. `evidence/phase-01/` · tests 66 → 79 |

| 2026-08-13 | **Phase 02 CLOSED — the heartbeat is installed, and the adversarial pass found that until today it could not have been.** `register`/`unregister` against the real Windows Task Scheduler, the six pinned settings written explicitly and read back off the OS, the fail-closed policy interlock, the rehearsed off-switch, and both v1 jobs live on the canonical clone. REQ-04 validated. **The headline is the finding, not the feature: `registrationFor` emitted `weekly:MON,TUE,WED,THU,FRI@06:00`, which `scheduler-task.ps1` refuses — so no weekdays job could be registered, and since `register` walks enabled jobs in file order with `brief-materialize` first, the entire unattended surface was unregisterable.** Three green checks looked straight at it: the real-OS smoke hand-typed its trigger and never went through `registrationFor`; the contract test *pinned the bug* by asserting the wrong string back; every other test used the daily job. Twenty-four findings from two fresh agents overlapping on three — including a log directory created at register time only (delete it and cmd fails opening the redirect *before* the job starts, so the job never runs and the mechanism added to make failures visible is the one hiding it), an argv joined with spaces, a readback that checked settings while ignoring command/arguments/cwd, `unregister` going through the legality gate so a broken policy file left tasks firing with no way to remove them, and a policy gate whose only control was blind to `BIRTH_CAP` being raised | CI **31674397504, 19/19 green** at `103f1a7`, read per-JOB, head SHA equal to local HEAD · merged as **`4b7410b`** (PR #163) · tests 79 → **106** across `jobs-contract` (19), `jobs-register` (15, new), `jobs-panel` (14), `jobs-lint` (44), `jobs-run` (14) · `evidence/phase-02/adversarial.md` + `smoke-and-offswitch.md` with the live readback transcript · `phase.closed` **`01KZX2FTDB324TSBCN83W02NSG`** read back out of `events/2026-08-13.jsonl`, 0 quarantined |

## Now

**Current position, 2026-08-23: Phases 00, 01 and 02 CLOSED. Phase 03 is RUNNING, the week has been
audited once, and it has already produced its finding.** Burn 2.5 of 3 days of *effort*; the
remaining 0.5d is the audit and retro at the far end of the elapsed window.

**The week is measured, and two of its numbers are the ones that matter most: manual starts 0, spend
₹0.** The audit over the six finished days 2026-08-17..22 reads `attempted 9 · completed 9 · failed
0 · missed 2`, all incident classes zero, and grades **NOT CLEAN on 2 unexplained gaps**, both on
2026-08-20.

**The gaps are the finding, not a blemish.** 2026-08-20 was an off day — no `events/2026-08-20.jsonl`
exists at all — and on the next wake both jobs caught up exactly ONE slot each, the newer one:
the 2026-08-21T14:56 receipts carry slot `2026-08-21`, never `2026-08-20`. **Windows queues at most
one missed instance per task**, so the older of two missed slots is silently lost. That is the
assumptions-ledger row firing at its own named trigger, and it is a sharper answer than the row
asked for: not a time window that abandons queued runs, but a queue one deep. Recorded as
**ADR-0807**, whose remedy — a logon trigger — ADR-0804 had already pre-committed to in writing
before any of this evidence existed.

**A second finding came out of trying to grade the week: the exit criterion itself was unreachable.**
`audit.mjs` accepts an explanation only from actor `scheduler:<job>`, and a powered-off machine emits
nothing — so no window containing an off day can ever grade CLEAN. The strict actor rule is right and
stays (it is what stops hand-written notes grading a dead scheduler clean); the criterion is what was
wrong, and it now reads "every gap classified, zero gaps in the class *arc was running and the job did
not fire*" — **ADR-0808**.

**A third: the fire-drill's own DoD contradicted itself** — "removed for ≥1 day" cannot produce the
needs-you line the same DoD requires, because the detector fires at `missed > OVERDUE_SLOTS` and
`OVERDUE_SLOTS = 2`. One day yields one missed slot and no line. Corrected in the spec.

**THE HEARTBEAT IS INSTALLED.** Both v1 jobs are registered on the real Windows Task Scheduler
from the canonical clone (`E:\Work_Hub\01_Automemory\arc`, main @ `4b7410b`), with all six pinned
settings read back off the OS. First slots: `day-close-roll` 2026-08-14T00:15, `brief-materialize`
2026-08-14T06:00. Neither has fired yet, by design — `lastTaskResult` is `0x41303` on both.

**Why the merge happened before Phase 03 rather than after every phase.** The owner's instruction
was one final merge at the end. Phase 03's exit criterion is "≥2 jobs unattended for ≥7 days", and
a job cannot run unattended from a worktree — `spineRoot()` refuses inside a linked worktree, so a
task registered there would write receipts no reader can see. Registration therefore requires the
canonical clone on `main`, which requires the merge. The sequencing as stated was unsatisfiable;
the owner was asked and chose to merge now so the clock could start today.

**What Phase 03 is waiting for, concretely:**

| Item | State |
|---|---|
| ≥2 jobs running unattended | ✅ since 2026-08-17, both registered, `day-close-roll` still firing daily |
| Zero manual starts, proven by an actor query on the spine | ✅ **0** over 2026-08-17..22 |
| Spend vs ceiling | ✅ **₹0**, as designed — both jobs are script-jobs |
| The ledger's `StartWhenAvailable` row answered with real data | ✅ answered: **DROPPED**, not merely late — ADR-0807 |
| Fire-drill | ⏳ **ARMED 2026-08-23 ~17:00** — `brief-materialize` OS task removed, `hq.jobs.yaml` untouched at `enabled: true`, `day-close-roll` left registered as the control |
| The needs-you line appears and is captured | ⏳ **2026-08-26 after 06:00** — computed by panel replay, not waited for: last real run 08-21T14:56, weekday slots 08-24/25/26, and `missed > 2` first holds on the third |
| Gap audit, §8 metric pack, `/arc-retro` | ⏳ at close, re-run over the full window |

**The AV watch item is CLOSED, and closed as wrong.** McAfee interference was the leading hypothesis
for the missing runs on 2026-08-13..16; the actual cause was a registered action that created its own
log directory only on first run, so every later run exited 0 having launched nothing. The action
launched cleanly and nothing was ever blocked. Recording that the hypothesis was wrong matters as
much as recording what was right — see `evidence/phase-03/week-log.md`.

**The open watch item now is the OTHER ledger row, and it has also FIRED:** the week records zero
lock contentions and zero incidents of every class (`policy-declined=0 overlap=0
receipt-write-failure=0 timeout=0 crash=0`). Two jobs on non-overlapping cadences were never going
to contend, so the overlap lock and the incident taxonomy remain proven by fixture and **never in
the real**. That is not a defect to fix inside this cycle — it is a limit on what this week is
allowed to claim, and the retro must say so rather than let green numbers imply coverage they do
not have.

**The appetite position, stated plainly: this cycle cannot afford its own remedy.** Burn is 2.5 of
3 days (83%), and the remaining 0.5d is the audit and retro. ADR-0807's logon trigger and ADR-0808's
downtime classification are real build work — a second trigger, idempotency fixtures for N logons a
day, and a re-read of the panel's overdue arithmetic against a job whose cadence becomes "scheduled
OR at logon". Building them inside that 0.5d is the silent extension the kill criteria forbid, so
both ADRs are recorded as decisions with implementation deferred to the next cycle's opening phase.
**The proving week's job was to find this. It found it, in the first window that contained a real
two-day outage.**

**Owner actions: all three DONE.** The `hq.policy.yaml` scheduler rows, the SessionStart nudge at
`.claude/hooks/SessionStart.d/60-jobs.sh`, and the opengrep pin in `.github/workflows/ci.yml` — the
last of which unblocked every lane, not only this one.

**WIP note (informational, ADR-0052 — never a gate):** `leads`, `bench` and `engine` remain live
alongside this lane. `wip-line.sh` reads only the current worktree, so a lane on an unmerged branch
is invisible to it.
