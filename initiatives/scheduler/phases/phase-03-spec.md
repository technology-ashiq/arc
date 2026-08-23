# Phase 03 — proving week + retro

**Goal (one line):** A real week of unattended running, with the silence detector itself proven by deliberately killing a job's OS task while its row still says it is enabled.
**Appetite:** 0.5 day of effort, ≥7 days elapsed — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] ≥2 jobs scheduled and running unattended for ≥7 consecutive days
- [ ] **Zero manual starts proven by an actor query on the spine** — scheduled fires carry `actor: scheduler:<job>`, attended runs carry the session actor, so this is a query result and not a diary claim
- [ ] All receipts present on the canonical spine in the main clone; **every gap in the window is CLASSIFIED, and zero gaps fall in the class "arc was running and the job did not fire" (ADR-0808)**. Amended 2026-08-23: the original wording was "gap audit clean", and it is unreachable by construction — `audit.mjs` accepts an explanation only from actor `scheduler:<job>`, and a powered-off machine emits nothing, so any window containing an off day can never grade CLEAN. The audit still prints every gap and still prints NOT CLEAN; what changed is which verdict closes a phase. The strict actor rule is untouched
- [ ] **Fire-drill (the detector is tested with smoke):** one job's OS registration is removed **until the needs-you line actually appears — which is the THIRD missed slot, not the first** — while `hq.jobs.yaml` still reads `enabled: true`; the real silent-death shape, where the file promises and the OS has quietly stopped. The missed-run needs-you line MUST appear and is captured in evidence, and a second job stays registered as the control: if BOTH go overdue, the drill has caught something else and the day is an incident, not a pass. Disabling the job in the yaml would NOT do: `enabled: false` legitimately suppresses overdue, so a disable-based drill would test nothing. Amended 2026-08-23: this criterion previously read "removed for ≥1 day", which contradicts its own next sentence — the detector fires at `missed > OVERDUE_SLOTS` and `OVERDUE_SLOTS = 2`, so one day produces one missed slot and no line at all. A drill run to the letter of the old wording would have proved nothing and read as a passing drill
- [x] **The assumptions ledger is settled, not carried:** the ledger's `StartWhenAvailable` row is answered with real data — did any slot get *dropped* after a sleep, or were they all merely *late*. **Answered 2026-08-23: DROPPED.** Both jobs had two slots outstanding across the 2026-08-20 outage and both recovered exactly the newer one, from receipts rather than inference — Windows queues at most ONE missed instance per task, which is a sharper answer than the row asked for and not the undocumented time-window it feared. Recorded as **ADR-0807**; the remedy is the logon trigger ADR-0804 had already named in writing before this evidence existed. The lane's OTHER Phase-3 ledger row (ADR-0806, "two jobs exercise the overlap lock and incident taxonomy meaningfully") has ALSO fired, in the negative: every incident class reads 0 and no lock contention exists anywhere on the spine, so both mechanisms stay proven by fixture and never in the real — the retro must state that limit rather than let green numbers imply coverage
- [ ] Metric pack computed **from the spine only**: runs attempted / completed / missed · drift p50 (`started_at − scheduled_for`) · manual starts for scheduled kinds (target 0) · incidents by class · quarantined double-fires · ₹ spent vs ceiling (expected ₹0) · brief-panel needs-you occurrences and whether each was true (the fire-drill must appear as at least one true positive)
- [ ] Evidence bundle at `initiatives/scheduler/evidence/phase-03/`
- [ ] `/arc-retro` run with the metric pack; TRIAL promotions reviewed
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when this phase starts: the week is graded against the pre-declared metric pack computed from spine queries only, and the fire-drill's needs-you line is captured as a screenshot or transcript at the time it appears — not reconstructed afterwards.

## Rabbit holes in this phase

- Grading the week on vibes → the metric pack is pre-declared in the PLAN so it cannot be chosen after the fact.
- A fire-drill that tests nothing → it must remove the OS task, never flip the yaml.
- Carrying the ledger's open rows forward unanswered → the week is the instrument that closes them.

## Out of scope for this phase

Any new job. Any new capability. If the week shows <2 jobs worth scheduling, the cron flip is parked (`register` stays off) and the attended wrapper plus brief panel are kept — they are already daily value.

## Your-setup / pending

Nothing to paste. The week runs on your machine; I will ask before removing and restoring the fire-drill job's OS task.

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
