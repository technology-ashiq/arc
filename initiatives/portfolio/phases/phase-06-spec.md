# Phase 06 — `lane-stale` job, needs-you, board-lint FAIL class, render, owner apply

**Goal (one line):** a daily governed job derives `stale` for silent LIVE lanes into instance state, raises it under needs-you, readers render it, and board-lint fails any hand-written stale field (REQ-08, ADR-0079).
**Appetite:** 0.7 days
**Depends on:** phase-04

## Non-negotiables (verbatim from PLAN)
- ADR-0051: no value on the board is typed by hand; `stale` is derived by the job and never written into PORTFOLIO.md (ADR-0079).
- Lock 4: PORTFOLIO.md's columns and row grammar do not change; no health score, no owner column, no ETA.
- The freeze's exempt lanes are read from the ruling's payload, never hardcoded; an unreadable ruling refuses, never exempts (ADR-0077).
- `hq.jobs.yaml` and `hq.policy.yaml` are written only by the owner-apply script the owner runs (ADR-1750); the job never runs ungoverned.
- The spine is read only through `.claude/scripts/hq/spine.mjs`; zero new event kinds.
- Lock 5: two-surface `/arc-attack` (logic + boundary, ADR-0226) per gate PR, carrying `initiatives/portfolio/fixed-defects.md`; the author is never the attacker; one round per PR.
- Tests run on CI only; every fixture asserts it RAN before asserting what it printed.
- feat/* branch; push freely; merge once, after every phase is complete (owner, 2026-10-14).

## Exit criteria (Definition of Done)
- [ ] `.claude/scripts/hq/jobs/lane-stale.mjs` + `processes/lane-stale.process.yaml` stub + `owner-apply-lane-stale.mjs` (idempotent; writes the `hq.jobs.yaml` row, `hq.policy.yaml` subject, stub)
- [ ] `board-lint.sh` FAIL class `board-stale-hand-written`; `arc-dash` (and face board fold if within the rabbit-hole bound) render `stale`
- [ ] `tests/portfolio-lane-stale.bats` green on CI per-JOB with growth 7-week and leads 9-week fixture silences
- [ ] live demo against the real spine, from the MAIN clone: run the job once by hand; `lane-stale.json` lists bench, growth and leads; `events/` AND `events/_quarantine/` both listed; one `incident.raised` `class: lane-stale` per lane LANDED in `events/` (not quarantined); `arc-brief` prints each lane by line; production `incident.raised` count before and after recorded in the evidence bundle. The owner apply is NOT a phase-close precondition
- [ ] the CI bats suite calls `board-lint.sh --strict`
- [ ] two-surface `/arc-attack` before push
- [ ] tracker updated

## Verification plan
Coarse: fixture spines for the 13/15-day boundary and the two real silences; second-run idempotency; brief needs-you line asserted by line, never by group; board-lint exit codes on real and seeded boards; `jobs-lint` on apply output. Refined at phase start.

## Out of scope for this phase
A stale column; any tracked-file write by the job. The apply is an OWNER ACTION delivered as ONE line: `cd <absolute main-clone path>` + `node .claude/scripts/hq/owner-apply-lane-stale.mjs` + `jobs-lint` + `git add hq.jobs.yaml hq.policy.yaml processes/lane-stale.process.yaml` + commit + push of exactly those files. Phase 06 closes on the script plus the fixture-repo idempotency proof, not on the owner running it; the PROGRESS row records `apply: owner-pending` and the cycle seals with it owed. Nothing schedules the job until it is applied.
