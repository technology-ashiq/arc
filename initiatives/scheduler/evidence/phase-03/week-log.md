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

---

## 2026-08-23 — the week audited, and the fire-drill armed

### The audit, 2026-08-17..2026-08-22

Computed from the spine only, in the canonical clone, over the six finished days of the restarted
window. `--to 2026-08-23` is refused by design: an unfinished day counts every future slot MISSED.

```
brief-materialize   weekdays@06:00   expected 5  completed 4  drift p50 19392000ms
  MISSED 2026-08-20T06:00:00+05:30
day-close-roll      daily@00:15      expected 6  completed 5  drift p50 3000ms
  MISSED 2026-08-20T00:15:00+05:30

attempted 9  completed 9  failed 0  missed 2
manual starts (target 0)  0
incidents  policy-declined=0 overlap=0 receipt-write-failure=0 timeout=0 crash=0
spend (expected 0)  INR 0

NOT CLEAN: 2 unexplained gap(s)
```

Manual starts are **0** and spend is **INR 0** — two exit criteria met and not in doubt. The week
is NOT CLEAN on gaps, and the reason is the finding below.

### Finding 1 — ADR-0804 is wrong: the slot was DROPPED, not late

The assumptions ledger asked exactly this and named exactly this trigger: *"the Phase-3 gap audit
finds a slot with no `run.completed` and no catch-up run after a wake — a dropped slot, not a late
one."* It has fired, and the receipts say so without inference:

| Receipt | Fired at | Slot it carried |
|---|---|---|
| `scheduler:day-close-roll` | 2026-08-21T14:56:25 | `2026-08-21T00:15:00` |
| `scheduler:brief-materialize` | 2026-08-21T14:56:25 | `2026-08-21T06:00:00` |

The machine was off through 2026-08-20 — there is no `events/2026-08-20.jsonl` at all. On the wake,
both jobs caught up, and **both carried the 08-21 slot, not the 08-20 one.** Windows queues only
the most recent missed instance; two slots missed across one sleep means the older one is gone.
`StartWhenAvailable` is therefore *late, not dropped* for a single missed slot (proved twice
already, at 11:48 and 12:49) and **dropped for the second and older one**. ADR-0804's premise that
Windows queues indefinitely holds for one slot and fails for two.

### Finding 2 — an off day is structurally unexplainable, so "gap audit clean" is unreachable

`audit.mjs` accepts an explanation only from the job itself:

> AN EXPLANATION MUST COME FROM THE SCHEDULER ITSELF. […] seven hand-written `note.logged` events
> with a session actor turned a completely dead scheduler into a CLEAN week.

That rule is right and must stay — it is what stops the fire-drill's required true positive being
erased by hand. But it has a consequence nobody wrote down: **a powered-off machine emits nothing,
so a day the machine was off can never be explained, and any window containing one can never grade
CLEAN.** The Phase-03 exit criterion *"gap audit clean (every expected slot has either a
`run.completed` or an explained absence)"* is, as written, unreachable on a laptop that gets shut
down. That is a real defect in the criterion, not in the machine.

### Finding 3 — the fire-drill's own DoD is internally inconsistent

The spec asks for two things that cannot both be true:

- *"one job's OS registration is removed for **≥1 day**"*
- *"The missed-run needs-you line **MUST appear** and is captured in evidence"*

The detector's threshold is `OVERDUE_SLOTS = 2` and the test is `missed > OVERDUE_SLOTS`, so the
line needs **three** missed slots. One day produces one. A drill run to the letter of the first
bullet would have proved nothing and read as a passing drill — the precise shape this lane exists
to refuse.

### The drill, armed 2026-08-23 ~17:00 IST

`brief-materialize` chosen over `day-close-roll`: a missed brief materialization loses nothing,
while a missed day-close leaves a day unsealed. `day-close-roll` stays registered, so the heartbeat
is never fully off and the drill's positive is isolated to one job.

BEFORE, read off the OS:

```
TaskName          State
brief-materialize Ready
day-close-roll    Ready

{"exists":true,"nextRunTime":"2026-08-24T06:00:00+05:30","lastTaskResult":0,
 "settings":{"WakeToRun":false,"StartWhenAvailable":true,"RunLevel":"Limited",
 "StopIfGoingOnBatteries":false,"LogonType":"Interactive","DisallowStartIfOnBatteries":false}}
```

AFTER `arc-jobs unregister brief-materialize`:

```
arc-jobs: unregistered brief-materialize
arc-jobs: 1 arc task(s) remain: day-close-roll

TaskName       State
day-close-roll Ready

brief-materialize -> {"exists":false}
```

`hq.jobs.yaml` still reads `enabled: true` for `brief-materialize`, and `git status` on the
canonical clone reports the file untouched. **That is the required shape: the file promises and the
OS has quietly stopped.** A yaml flip would have tested nothing, because `enabled: false`
legitimately suppresses overdue.

### When the line will appear — computed, not waited for

`derivePanel` is pure and `--date D` is a replay, so the drill's outcome was predicted before it
happened rather than discovered afterwards. Last real run 2026-08-21T14:56:25; weekday slots after
it are 08-24, 08-25, 08-26; `missed > 2` first holds on the third:

| Replay date | brief-materialize | needs-you |
|---|---|---|
| 2026-08-24 | healthy, next 08-25T06:00 | — |
| 2026-08-25 | healthy, next 08-26T06:00 | — |
| **2026-08-26** | **OVERDUE (3 missed)** | **`job brief-materialize silent since 2026-08-21T14:56:25+05:30 -- 3 scheduled slots missed (weekdays@06:00)`** |

The replay also shows `day-close-roll` going overdue on 08-26, because a replay assumes no further
runs. In the real world it stays registered and its `last` keeps advancing, so on the day it should
read healthy while `brief-materialize` alone raises the line. **That difference is the drill's
control: if both go overdue on 2026-08-26, the drill has caught something else and the day is an
incident, not a pass.**

So the capture date is **2026-08-26, after 06:00 IST**, and the drill is 3 days long, not 1.
