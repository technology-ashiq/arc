# ADR 0079 — `stale` is derived by a daily job from the spine and is never written in PORTFOLIO.md

**Status:** accepted
**Date:** 2026-10-14
**Product:** `portfolio`
**Reversibility:** two-way
**Revisit trigger:** a LIVE lane doing real work is derived stale because its work emits no `payload.lane` receipts (the silence rule measures bookkeeping, not work), or the owner asks for the stale mark inside the committed board file

## Context
ADR-0051: the board is a view, never hand-kept. Three LIVE lanes have gone silent with nobody noticing:
growth (no lane-named receipt in ~7 weeks), leads (~9 weeks), bench (none ever). Receipts carry no
top-level lane; `payload.lane` is the only lane name (107 of 1,881 receipts: `phase.closed`,
`approval.requested`, `kickoff.done`, `develop.started`, `slice.done`). A daily job reads instance state;
it must not dirty a tracked file in the owner's main clone every morning (`git pull` would then refuse).

## Options considered
1. **A `hq.jobs.yaml` script row (ADR-1750 pattern) derives stale into instance state, raises one `incident.raised` per silent lane, and the readers that render the board read the state; the committed PORTFOLIO.md never carries `stale`** — no column change, no daily tracked-file churn.
2. **The job rewrites a generated block in PORTFOLIO.md** — a tracked file modified daily in the main clone; CI cannot verify it (no spine on CI).
3. **A `stale` column** — forbidden by the cycle's lock 4.

## Decision
Option 1:
- **Rule:** a lane is stale iff its `PROGRESS.md` machine header reads `status: LIVE` and no spine receipt with `payload.lane == <lane>` has a `ts` within the last 14 days, **excluding every `incident.raised` whose `payload.class == "lane-stale"`** — the job's own receipts never count as activity (strictly more than 14×24 h since the newest one, or none ever).
- **Job:** `lane-stale` (`.claude/scripts/hq/jobs/lane-stale.mjs`), `daily@08:00`, `catchup: skip`, `policy_kind: process:lane-stale`, with a `processes/lane-stale.process.yaml` `job_stub: true` and an `hq.policy.yaml` subject whose only write root is `.claude/state/portfolio/**` plus `.claude/state/hq/**` for its receipts. It writes `.claude/state/portfolio/lane-stale.json` (`{derived_at, window_days, lanes: {<lane>: {stale, last_ts, last_id}}}`) and emits `incident.raised` `{class: "lane-stale", silent_lane, what: "lane <lane> LIVE with no lane receipt since <date|ever>"}` once per silence episode (idem over lane + newest receipt id), which `arc-brief` already lists under needs-you. Zero new event kinds.
- **Render:** the readers that render the board (`arc-dash`, face's board fold) show `stale` beside a lane's status from `lane-stale.json` — the committed table is untouched.
- **Lint:** `board-lint.sh --strict` gains its first FAIL class, `board-stale-hand-written`: a table header cell equal to `stale`, or a data cell matching `^\s*stale\s*[:=]`, is hand-written by construction, so it exits 1. The prose word "stale" in a `next` or blocked-on cell is not a field. Without `--strict` the exit stays 0 on every path, so existing callers are unchanged; the CI suite passes `--strict`. Every existing class stays WARN.
- **Governance:** `hq.jobs.yaml` and `hq.policy.yaml` are owner-applied (ADR-1750): one script, `owner-apply-lane-stale.mjs`, writes the job row, the policy row and the stub, idempotently. Until the owner runs it the job exists and nothing schedules it.

## Consequences
Easier: silence is noticed by a job, every day, without a human reading the board. Harder: a lane that
works without emitting lane-named receipts reads stale — that is the revisit trigger, and the remedy is a
receipt, never a hand edit.
