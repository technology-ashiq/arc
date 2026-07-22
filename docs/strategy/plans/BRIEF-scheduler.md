# BRIEF — scheduler (the heartbeat)

> **Trigger (pull):** the FIRST process earns L3 (proven safe to run unattended), OR a
> daily job (brief compile, ops sweep, discover hunt) is being started manually often
> enough to be silly. **Prereqs:** policy engine (headless runs MUST be policy-checked)
> · spine (every run is an event). **Order matters: policy BEFORE scheduler, always.**

**Goal:** cron-class scheduling OUTSIDE arc (the mold stays daemon-free per its own ADR):
a jobs file → OS scheduler (Task Scheduler/cron) or GitHub Actions cron → headless
`arc-run` invocations with budget + policy enforcement — cursors make consumers catch up,
so "scheduled" needs zero consumer changes.

**REQs (measurable):**
1. `hq.jobs.yaml`: job = process + driver + budget + policy-kind + cadence; jobs-lint
   (bad cadence, unknown process, missing budget → exit 2; fixtures pinned).
2. Runner wrapper: every scheduled run = `run.completed` event (cost, outcome); failure →
   `incident.raised`; overlapping-run prevention (lockfile; second instance exits loud,
   fixture-proven).
3. Budget + policy enforced identically to manual runs (same wrapper — fixture: a
   scheduled job cannot exceed what a manual run of the same kind could).
4. Missed-run visibility: the brief's background group shows last-run/next-run per job;
   a job silently not running >2× its cadence surfaces as needs-you.
5. One real week: ≥2 jobs (e.g. nightly brief compile + ops sweep) running scheduled,
   zero manual starts, all receipts on the spine.

**Appetite:** 3 days.
**Phases sketch:** 0 jobs file + lint + wrapper (lock/overlap adversarial) → 1 OS/CI
registration + missed-run detection → real week + retro.

**Non-negotiables/no-gos:** no daemon inside arc (external cron ONLY — the mold's no-
daemon ADR stands) · policy engine is a hard prerequisite (no policy = no scheduler,
period) · every run budgeted (an unbudgeted job fails lint) · no money-touching jobs
schedulable at all in v1 (lint rejects spend-capability kinds) · no retry storms (one
retry max, then incident).

**Pre-mortem top-3:** (1) runaway scheduled spend → budgets in lint + spend-kinds banned
from scheduling v1; (2) silent job death → missed-run detection is a REQ, not monitoring
hope; (3) overlap corruption → lockfile fixture.

**Open decisions at kickoff:** OS scheduler vs GH Actions (or both) · first two jobs ·
failure notification path (brief-only vs push).

**Kickoff prompt:**
```
/arc-kickoff scheduler — the heartbeat
Design source: docs/strategy/plans/BRIEF-scheduler.md (trigger: <first L3 process /
manual-start pain>). Policy engine MUST be live — verify, else STOP. Expand to full PLAN;
no-daemon + budgets + spend-ban locked. STOP after PLAN + specs for my approval.
```
