# Phase 01 — the attended heartbeat

**Goal (one line):** From this day the heartbeat is usable — one command runs everything due, and the brief tells you which jobs have gone quiet.
**Appetite:** 0.5 day — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] `arc-jobs run <name>` · `arc-jobs catchup` · `arc-jobs list --next 7` all working — `--next 7` prints the coming week's slot timetable so the schedule is inspectable before and after registration
- [ ] `catchup` the COMMAND runs every overdue job regardless of each job's `catchup:` FIELD (the field governs only automatic late-firing); the receipt's actor records that a human asked
- [ ] Brief jobs panel renders last run / next expected / overdue per job, as a **pure function of (date, `hq.jobs.yaml`, spine events ≤ that day)** — `Date.now()` is banned in the panel and a lint proves its absence
- [ ] `arc-brief --date D` replay is **byte-identical** against a pinned golden fixture
- [ ] Overdue > 2× cadence emits a needs-you line naming the job and how long it has been silent
- [ ] `enabled: false` jobs render as *disabled* and are **never** counted overdue — a deliberate off is not a silent death
- [ ] SessionStart fragment READS and PRINTS only (e.g. "2 jobs overdue — run `arc jobs catchup`") and can never execute a job — proven by a lint, because a nudge that can run things is a back-door daemon
- [ ] tests added & green **on CI**, read per-JOB
- [ ] live demo run + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `npx bats tests/arc-jobs-attended.bats tests/brief-jobs-panel.bats`
- **Expected failure first:** `tests/brief-jobs-panel.bats` case `--date replay is byte-identical` fails RED before this phase is built with `no jobs panel in brief output` — and the determinism case is written to fail a second, distinct way if the panel is built with a wall-clock read: the fixture renders the same `--date` twice across a simulated midnight boundary and asserts the two outputs are identical bytes, which a `Date.now()` implementation fails even when the first assertion passes.
- **Live demo scenario:** (1) With `day-close-roll` deliberately not run for 3 days, `arc-brief --date 2026-08-15` shows it under needs-you as silent since 2026-08-12. (2) Flipping that job to `enabled: false` and re-rendering the same `--date` moves it to *disabled* and removes the needs-you line. (3) `arc-jobs list --next 7` prints 7 days of slots for both jobs. (4) `arc-jobs catchup` runs both overdue jobs and each receipt carries the session actor, not `scheduler:<job>`.
- **Real-system check:** the panel is read against the real canonical spine in the main clone for one real date, and the same date rendered from a fixture spine must agree on every job row.
- **Expected evidence:** `initiatives/scheduler/evidence/phase-01/` — CI run id with per-JOB conclusions, the golden fixture, and the demo transcript showing the same `--date` rendering identically twice.

## Rabbit holes in this phase

- The SessionStart nudge growing the ability to run a job → hard line, lint-enforced, listed as an exit criterion.
- A full per-job detail panel → the minimal version ships; detail is deferred.
- Wall-clock creeping into the panel for "convenience" → the byte-identical replay fixture is the control, and it is written to fail on that specific mistake.

## Out of scope for this phase

All OS registration → Phase 02. Per-job catchup policies beyond the global default `skip` plus the two `run` exceptions → deferred. Any change to what the brief already renders outside the jobs panel.

## Your-setup / pending

Nothing. This phase adds no external dependency and needs no owner action.

## Non-negotiables (verbatim from PLAN)

- No daemon: arc never runs a resident process, and the OS scheduler is the only timer.
- The scheduler layer owns ZERO retries: ADR-0203 and ADR-0204 own the ladder, and a failed run's retry is its next cadence slot.
- Every execution, attended or scheduled, walks one path: lock, guards, execute, receipt.
- Authorization goes only through the shared POL-D library per ADR-0802, and this lane never writes a second reading of policy.
- Money-touching jobs are unschedulable: banned by `jobs-lint` on top of policy's own money law, not merely out of scope.
- The overlap lock is per job and reuses the spine's `withLock` discipline; a second hand-rolled lock is banned.
- This lane numbers ADRs only in 0800-0899 per ADR-0800, and cites no receipt it has not read per ADR-0801.
- A gate or parser is not done until two fresh adversarial agents on different surfaces have attacked it and every hole found is fixed and pinned as a fixture.
- A test that passes proves the assertion held, not that the code ran: assert it RAN before asserting what it printed.
- "Tests green" means green on CI, read per-JOB, at a run whose head SHA is the local HEAD.
