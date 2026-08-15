# Phase 03 — the proving week, as it happens

A running log, written at the time rather than reconstructed at the end. The metric pack is
computed by `arc-jobs audit`; this file records what a person had to go and look at.

Registered 2026-08-13. Earliest close 2026-08-20.

---

## 2026-08-15 — day 2. The heartbeat beats, and the detector has already earned its keep.

### What worked

`day-close-roll` fired at its slot and did the work.

```
$ Get-ScheduledTaskInfo -TaskName day-close-roll -TaskPath \arc\
LastRunTime    2026-08-15T00:15:01+05:30
LastTaskResult 0

$ cat <spine>/job-logs/day-close-roll.log
day-close-roll: sealed=17 already_sealed=0 empty=0 failed=0
{"sealed":["2026-07-23", ... ,"2026-08-13"],"already_sealed":[],"empty":[],"failed":[]}
arc-jobs: day-close-roll ok in 4944ms (slot 2026-08-14T00:15:00+05:30, actor scheduler:day-close-roll)
```

Unattended, receipted, with the right actor — and it sealed **seventeen** days that had been sitting
unsealed since 2026-07-23. That is the job doing the thing it exists for, on the first night nobody
was watching.

The audit agrees, and reports a drift of 2 seconds:

```
day-close-roll  daily@00:15
  expected 2  completed 1  failed 0  drift p50 2000ms
```

### What did not, and it is the more valuable half

**`brief-materialize` has a run the OS calls successful and that left no trace anywhere.**

```
$ Get-ScheduledTaskInfo -TaskName brief-materialize -TaskPath \arc\
LastRunTime        2026-08-14T11:48:00+05:30      <- not its 06:00 slot; a StartWhenAvailable catch-up
LastTaskResult     0
NumberOfMissedRuns 0
NextRunTime        2026-08-17T06:00:00+05:30      <- Monday. The weekend skip is correct.
```

Against that, three independent reads say nothing ran:

| Evidence | Reading |
|---|---|
| `<spine>/job-logs/brief-materialize.log` | **does not exist** — and the action redirects with `>>`, which creates the file even for zero output |
| `<spine>/job-logs/` directory mtime | still `2026-08-14 00:15:01`, when `day-close-roll` created it. Creating a file at 11:48 would have moved it |
| `events/2026-08-14.jsonl` | exactly one `run.completed`, and it is `day-close-roll`'s |
| `events/_quarantine/` | newest file is 2026-08-12; no job receipt was written and rejected |

So this is not a lost receipt and not a rejected one. **The action never executed, and Task
Scheduler recorded a successful run anyway.**

### Why this is the finding the week was for

It is the exact shape the whole cycle exists to catch, arriving unprompted on day two: the OS
reports health, and the work did not happen. Every layer that could have hidden it did not —

- the **audit** counts the slot as an unexplained gap rather than trusting the OS
- the **panel** derives a needs-you line from the silence, with no event to subscribe to
- the **per-job log** is what proved the action never ran, which is precisely why Phase 02 refused
  to register a task without one

```
$ arc-jobs audit --from 2026-08-13 --to 2026-08-14
  brief-materialize   weekdays@06:00
    expected 2  completed 0  failed 0
    gaps: 2 unexplained, 0 explained, 0 failed
      MISSED 2026-08-13T06:00:00+05:30
      MISSED 2026-08-14T06:00:00+05:30
...
NOT CLEAN: 3 unexplained gap(s)
```

The third gap is `day-close-roll`'s 2026-08-13 00:15 slot, which is honest: the jobs were
registered later that day, so that slot passed before the task existed.

### What is NOT being changed, and why

The obvious repair is to make the task action write a start marker before invoking node, so that
"no log at all" and "node died immediately" stop looking identical. It is a good change and it is
**not being made this week.** Re-registering the tasks mid-window resets the very measurement the
window exists to take, and a proving week that is edited while it runs proves nothing. It is routed
through `/arc-change` for the close instead, so it is queued rather than lost.

### The diagnosis gap, and the one thing only the owner can close

Windows keeps a per-task history in `Microsoft-Windows-TaskScheduler/Operational`, and on this
machine it is **off**:

```
$ wevtutil gl Microsoft-Windows-TaskScheduler/Operational
enabled: false
```

That log is where "action started / action completed / exit code" is recorded, and it is the one
place that would say what happened at 11:48. Enabling it needs an elevated prompt, which this
session cannot open.

**Owner action — one elevated command, worth doing before the next weekday slot on Monday 06:00:**

```
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
```

Run it from an **Administrator** terminal. It changes nothing about the tasks or the repo; it only
starts recording what Task Scheduler already does. Without it, if this recurs on Monday we will
know only that it recurred.

### Carried forward

- The AV watch item from Phase 02 is now **live rather than theoretical**. A run that Task
  Scheduler starts and that never reaches `cmd.exe` is consistent with an on-access scanner
  holding or blocking the launch — and the active scanner here is McAfee, whose exclusions
  `Get-MpPreference` cannot enumerate. Not concluded; recorded as the leading hypothesis with the
  evidence that would confirm it (the Operational log above).
- `StartWhenAvailable` is doing its job: the 11:48 timestamp is a catch-up of an 06:00 slot, so a
  missed slot is being retried late rather than dropped. The assumptions-ledger row asks exactly
  this question, and the answer so far is **late, not dropped**.
