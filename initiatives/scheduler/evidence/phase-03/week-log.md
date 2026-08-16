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

### The log is on, and it was PROVEN to record rather than assumed to

The owner ran the elevated command the same day:

```
$ wevtutil gl Microsoft-Windows-TaskScheduler/Operational
enabled: true
```

Enabled is not the same as recording what we need, and finding that out on Monday — after the
event we are waiting for — would waste the whole point of turning it on. So it was tested against
a **throwaway** task rather than a real job: starting `brief-materialize` by hand would write a
receipt with a session actor and put a manual start into the metric pack, and that is the one
number the week must keep at zero.

```
$ probe-oplog.ps1            # register \arc\arc-oplog-probe, start it, read back, remove it
REGISTERED
LAST_RESULT=0
MARKER_WRITTEN=True
OPLOG_EVENTS=9
  15:30:52  id=325  Task Scheduler queued instance ... of task "\arc\arc-oplog-probe".
  15:30:52  id=110  Task Scheduler launched ... instance of task "\arc\arc-oplog-probe" for user "ashiq".
  15:30:52  id=129  Task Scheduler launch task "\arc\arc-oplog-probe", instance "cmd.exe" with process ID 27628.
  15:30:52  id=100  Task Scheduler started ... instance of the "\arc\arc-oplog-probe" task.
  15:30:52  id=200  Task Scheduler launched action "cmd.exe" in instance ... of task "\arc\arc-oplog-probe".
  15:30:52  id=201  Task Scheduler successfully completed ... action "cmd.exe" with return code 0.
  15:30:52  id=102  Task Scheduler successfully finished ... instance of the task.
REMOVED=True
```

Afterwards, the machine is exactly as it was — `list` returns the two real jobs and nothing else,
and the pack still reads `manual starts (target 0)  0`.

**This makes Monday decisive rather than merely observed**, because the two hypotheses now render
differently in the log:

| What the log shows on 2026-08-17 06:00 | What it means |
|---|---|
| `100`/`102` present, **no `200`/`201`** | Task Scheduler started an instance and **never launched the action**. The run that "succeeded" while doing nothing is a scheduler-side event, and the missing log file is a consequence rather than the cause |
| `200` present, `201` with a non-zero return code | The action launched and `cmd.exe` failed — and then the absent log file points at the redirect or at something holding the launch, which is where the AV hypothesis lives |
| `200` and `201` both clean, still no log file and no receipt | Something between `cmd.exe` starting and the redirect opening. The narrowest and least likely case, and the only one that would need a new instrument |

Written down BEFORE the event, so the reading cannot be chosen after seeing which one happened.

### Carried forward (superseded on 2026-08-16 — see below)

- The AV watch item from Phase 02 is now **live rather than theoretical**. A run that Task
  Scheduler starts and that never reaches `cmd.exe` is consistent with an on-access scanner
  holding or blocking the launch — and the active scanner here is McAfee, whose exclusions
  `Get-MpPreference` cannot enumerate. Not concluded; recorded as the leading hypothesis with the
  evidence that would confirm it (the Operational log above).
- `StartWhenAvailable` is doing its job: the 11:48 timestamp is a catch-up of an 06:00 slot, so a
  missed slot is being retried late rather than dropped. The assumptions-ledger row asks exactly
  this question, and the answer so far is **late, not dropped**.

---

## 2026-08-16 — day 3. Found it. It was mine, and the week restarts.

`day-close-roll` did it too: `LastRunTime 2026-08-16T12:49:42`, `LastTaskResult 0`, and no new line
in its log. Two different jobs, same shape — so not a job bug and not luck.

### The log the owner enabled answered it in one read

```
12:49:42  id=114  could not launch as scheduled ... started now as required by StartWhenAvailable
12:49:42  id=129  launch task, instance "cmd.exe" with process ID 48068
12:49:42  id=100  started instance of the task
12:49:42  id=200  launched action "cmd.exe"
12:49:44  id=201  successfully completed ... action "cmd.exe" with return code 0
12:49:44  id=102  successfully finished instance
```

That is the **third** of the three readings written down yesterday, before the event: `200` and
`201` both clean, no log, no receipt. cmd launched, returned 0, and did nothing — in two seconds,
where the one real run took 4944ms.

### The cause, measured rather than reasoned about

The task action was `if not exist DIR md DIR & PROG`. **`cmd` binds the entire remainder of the
line to the `IF`**, so when the directory exists the program never runs and cmd exits 0.

```
$ node cmd-if-parse.mjs
DIR MISSING: exit=0  logWritten=true   body="RAN"
DIR EXISTS : exit=0  logWritten=false  body=null
```

Three candidate repairs, measured in both states:

```
A  md DIR 2>nul & PROG              dirMissing: ran=true   dirExists: ran=true
B  if not exist DIR (md DIR) & PROG dirMissing: ran=true   dirExists: ran=false
C  if not exist DIR md DIR & PROG   dirMissing: ran=true   dirExists: ran=false   <- shipped
```

Parenthesising does not help. The conditional had to go entirely: `md` on an existing directory
errors, `2>nul` swallows it, and `&` then runs the program unconditionally — nothing left for the
parser to bind.

### Where it came from, and the lesson that is not "be careful"

**This is my defect, and it shipped inside the FIX for a different one.** The Phase-02 adversarial
pass found that the log directory was created at register time only, so deleting it would break
the redirect before the job started. The repair created it at run time — and the fixture written
alongside tested the directory-**MISSING** branch, which is the first run and never happens again.
The failure path was covered; the normal path was not.

So the timeline reads:

| Slot | What happened |
|---|---|
| 2026-08-14 00:15 `day-close-roll` | directory absent → `md` ran → node ran → **17 days sealed, receipt landed** |
| 2026-08-14 11:48 `brief-materialize` | directory now exists → nothing ran → exit 0 |
| 2026-08-16 12:49 `day-close-roll` | directory exists → nothing ran → exit 0 |

**Every scheduled run after the very first one was a no-op reporting success.**

### The repair, proven against the real OS

Re-registered, and the action read back off the machine:

```
/c "md "E:\...\job-logs" 2>nul & "C:\Program Files\nodejs\node.exe" "E:\...\arc-jobs.mjs"
    "run" "day-close-roll" "--scheduled" >> "E:\...\job-logs\day-close-roll.log" 2>&1"
```

Then fired for real, with the directory already present — the exact state that used to do nothing:

```
log 3 lines -> 6 lines
{"sealed":["2026-08-14"],"already_sealed":[...17 days...],"empty":[],"failed":[]}
arc-jobs: day-close-roll ok in 2527ms (slot 2026-08-16T00:15:00+05:30, actor scheduler:day-close-roll)
OS: LastRunTime 2026-08-16T12:56:11  result 0
```

It ran, it sealed the day that had been missed, and it receipted. The actor is still
`scheduler:day-close-roll` because the registered action carries `--scheduled`, so this does not
put a manual start into the pack.

### What this costs: the week restarts

There is nothing to measure in 2026-08-13..16 — the system was a no-op for all but one slot, so
those days grade the bug rather than the heartbeat. **The proving window restarts at 2026-08-17,
and the earliest close moves to 2026-08-24.** Saying the week ran would be the one thing this
lane exists to refuse.

The three days are not wasted, and this is the honest reading of them: an unattended system
silently did nothing for three days while the OS reported success, and **the instruments caught it
without being told to** — the audit counted the gaps, the panel derived needs-you lines from
silence, and the per-job log is what proved the action never launched. That is the capability the
week is meant to demonstrate, demonstrated against a real fault instead of a drill.

### Carried forward, revised

- The AV hypothesis is **dropped**. It was the leading theory yesterday and the evidence now points
  elsewhere entirely — the action launched and returned cleanly; nothing was blocked. Recording
  that it was wrong matters as much as recording what was right.
- `StartWhenAvailable` is confirmed working in both observed cases (11:48 and 12:49 are catch-ups
  of 06:00 and 00:15 slots). The assumptions-ledger row stays **late, not dropped**.
- The fire-drill has not been run and is not needed as a scheduled exercise this week: the system
  produced the real thing. It will still be run, because a drill proves the detector on demand
  rather than by luck.
