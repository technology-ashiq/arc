# Phase 00 live demo -- arc-scheduler, 2026-08-12

Run against a sandbox spine (ARC_SPINE_ROOT), which is what phase-00-spec calls for:
"Real-system check: n/a -- fakes only this phase." Real registration is Phase 02.

```
$ arc-jobs list --next 3
brief-materialize      enabled   weekdays@06:00     script
  2026-08-13T06:00:00+05:30
  2026-08-14T06:00:00+05:30
  2026-08-17T06:00:00+05:30
day-close-roll         enabled   daily@00:15        script
  2026-08-13T00:15:00+05:30
  2026-08-14T00:15:00+05:30
  2026-08-15T00:15:00+05:30

# note Aug 14 (Fri) -> Aug 17 (Mon): the weekend is skipped, live

$ arc-jobs run day-close-roll     # two unsealed days seeded
day-close-roll: sealed=2 already_sealed=0 empty=0 failed=0
{"sealed":["2026-08-01","2026-08-02"],"already_sealed":[],"empty":[],"failed":[]}
arc-jobs: day-close-roll ok in 476ms (slot 2026-08-12T00:15:00+05:30, actor session)
exit=0

$ arc-jobs run day-close-roll     # same slot again
arc-jobs: day-close-roll slot 2026-08-12T00:15:00+05:30 already has a receipt (01KZTJF2VD46K71VM96J2ZQPF4) -- this is a double fire, and the second run is skipped rather than re-executed
exit=0

$ grep run.completed on the spine
"actor":"session"
"outcome":"ok"
"idem_preimage":"day-close-roll@2026-08-12T00:15:00+05:30"
"outcome":"ok"

$ node .claude/scripts/engine/arc-run.mjs --process day-close-roll --driver auto
arc-run: `day-close-roll` is a scheduled-job stub, not a runnable process.
         It exists so the job has a policy subject (ADR-0802/ADR-0504). Its work lives in
         .claude/scripts/hq/jobs/ and is run by: node .claude/scripts/hq/arc-jobs.mjs run day-close-roll
exit=1 (job stub refused before any driver was selected)
```
