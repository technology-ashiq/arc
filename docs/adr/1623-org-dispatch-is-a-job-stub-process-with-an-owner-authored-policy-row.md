# ADR 1623 — `org-dispatch` is a job-stub process whose policy row the owner authors

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The owner has not landed the `process:org-dispatch` row when Phase 03 opens -> the dispatcher runs dry-run only (prints proposals, emits nothing) until it lands; the INR ceiling is never raised to route around it.

## Context
The design source (ORG-E) says the dispatcher "adds no policy subject", citing the reader-only pattern of ADR-0703 and the ledger/bench precedents. The kickoff attack panel (focus A) checked that against the live tree, and the tree says otherwise. `hq.jobs.yaml:15-17` requires every job's `policy_kind` to be a subject in `hq.policy.yaml`. ADR-0504 closes that set to `session:interactive` or `process:NAME`, where NAME is a real `processes/` stem carrying `job_stub: true`. This is exactly how `day-close-roll` and `brief-materialize` run. `hq.policy.yaml` is in its own `ungrantable_resources`, so no session can write it. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Job-stub process + owner-authored policy row.** `processes/org-dispatch.process.yaml` with `job_stub: true` becomes the 14th process. It is an addition, not a rewrite of the 13. The owner adds a `process:org-dispatch` row at L1 with `e2: []`. Lane work delivers that row as a paste-ready diff.
2. **Run the dispatcher outside the scheduler** (manual or `session:interactive`). This avoids the policy edit, but loses the heartbeat that ORG-E locks and makes every run count as a MANUAL start in `lib/jobs/audit.mjs`.
3. **Make it a `type: process` job.** This needs `budget.inr` > 0 and breaches `monthly_ceiling_inr: 0`.

## Decision
Option 1. The dispatcher is still a deterministic `type: script` job at ₹0. It still makes proposals only and never executes. It gains exactly one policy subject, `process:org-dispatch`, at L1 with no capabilities beyond emitting `approval.requested`. This corrects the design source's "adds no policy subject" line to what ADR-0504 requires. It does not relax any locked decision: ORG-E's lock names the ₹0 script-job, the proposals-only rule, goal ancestry, the cap of 7, the heartbeat, the budget skip and the ban on agent-to-agent calls, and all of those stand.

## Consequences
Easier: the scheduler audit stays true and the job follows a proven pattern. Harder: Phase 03 depends on one owner edit to `hq.policy.yaml`. `kickoff-lint`'s `[birth-rule]` and `policy-lint` fail if the stub lands without the row, so the stub and the owner's row land in the same PR.
