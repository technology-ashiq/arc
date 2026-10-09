# ADR 1750 — the weekly watch is `verify --all --public-only`, run by a daily job that acts every seven days

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the schedule grammar gains a weekly form (ADR-0802), or a provider exposes a pause status launch
should read itself

## Context

REQ-10: one `hq.jobs.yaml` script-class row runs `verify --all --public-only` weekly. A slot gated by a token reports
`skipped(env)` and stays out of the brief. A provider-reported pause is `PAUSED(reason)`. A forced regression produces
exactly one `needs-you` line, and a `skipped(env)` slot produces zero. The jobs grammar is closed to `daily@` and
`weekdays@` (ADR-0802).

## Decision

- `verify --public-only` changes three outcomes in `verifySlots`:
  - a verify the worker refused for a missing key (its `missing_env` flag, never the reason text) is logged
    `skipped(env:KEY)` and counted apart;
  - a reason starting `PAUSED(` is logged as given;
  - any other failure, a thrown or unverifiable slot included, emits `incident.raised` once for that slot (`what: launch verify: <slot> regressed for
    <venture>: <reason>`), which the brief lists under needs-you.

  A skipped or paused slot does not fail the run.
- Job `launch-watch` (`.claude/scripts/hq/jobs/launch-watch.mjs`) runs `daily@07:30` with `catchup: skip`. It acts
  on a board only when that board's last watched IST day, kept per board in `.claude/state/launch/.watch-last` (instance
  state, never the repo), is seven or more days old, or absent, or in the future. Acting means one
  `arc-launch verify --all --public-only` for that board. A board is stamped only when it was watched: the runner
  finished and its `watch-result` line shows every failed slot raised. A board that failed retries the next day, alone.
- The policy subject is `process:launch-watch`, with the `processes/launch-watch.process.yaml` stub (`job_stub:
  true`), as brief-materialize has. Its `hq.policy.yaml` row is the owner's: that file is on the deny floor, and the
  birth rule gates every process on it.

## Consequences

- The `hq.jobs.yaml` row ships with the policy row, not before it. `jobs-lint` fails any job whose `policy_kind` the
  live policy lacks, so a row merged ahead of the subject would turn CI red. One owner apply,
  `owner-apply-watch-policy.mjs`, writes both rows, and a second run of it changes nothing. The process stub follows
  the same rule: it ships declaring `fs.read` only, because the every-process gate blocks a process that declares
  more than its absent subject allows. The same apply widens it to `fs.write` and `shell.run` of arc-launch, then
  rebuilds the wiki. Until then the job script
  and its stub exist, nothing schedules them, and the job never runs ungoverned.
