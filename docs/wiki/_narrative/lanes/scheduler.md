<!-- facts: appetite=39b40118 blocked-on=39bf1db6 burn=7bd4fb72 cycle=43b10f08 depends-on=a68c9074 hasPlan=b5bea41b phase=0b3aa5a1 status=8ddd7aee title=ae009067 -->
```tagline
The alarm clock for arc's daily chores. A list of jobs sits in git, the computer's own clock rings each
one, every ring leaves a receipt, and a chore that stops ringing shows up on the morning briefing.
```

# Start here

## In plain words

Think of arc as a small shop. Some chores have to happen every day whether or not anyone remembers:
closing yesterday's books, writing the morning briefing. If they depend on a person typing a command,
sooner or later nobody types it.

```panel big
**scheduler is the alarm clock, plus the person who checks that it rang.** Three parts:

- **The chore list** (`hq.jobs.yaml`). One file in git that names every scheduled chore and when it is due. A checker (`jobs-lint`) refuses a bad entry before it can ever run.
- **The one door** (`arc-jobs`). Every run, whether a person started it or the clock did, walks through the same door: take a lock, check the rules, do the chore, write a receipt.
- **The computer's own clock.** arc runs no background program of its own. The operating system's scheduler is the only timer.
```

### What this lane is for

The goal in `initiatives/scheduler/PLAN.md` is to turn every daily arc chore into a run that leaves a
receipt, has a budget and is checked against the rules. The hard part is not making chores run. It is
making **silence visible**: a chore that dies emits nothing, so nobody sees it missing unless something
is watching for the gap.

### Why the plan is small

The plan gave itself a three-day time budget (its appetite). It named two chores to start with, both
scripts (`brief-materialize` on weekday mornings, `day-close-roll` daily), because the process files
that existed were all interactive commands that cannot run alone. Money-spending jobs are refused outright.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary alarm-clock thing wearing a technical name.
```

```rosetta
`hq.jobs.yaml` | the chore list | one git file naming every scheduled chore
`jobs-lint` | the list checker | refuses a bad entry at commit time, before it can run
`arc-jobs` | the one door | lock, rules, do the chore, write the receipt
slot | the moment a chore is due | a repeat ring for the same moment is recognised as a repeat
catchup | doing the chores missed while the machine was off | runs when the machine next wakes
needs-you line | "this chore has gone quiet" | printed in the morning briefing
`register` / `unregister` | hand the list to the clock / take it back | `unregister` switches the whole thing off
fire-drill | unplug one alarm on purpose | proves the quiet-chore warning really appears
```

## How one chore runs

```lede
Every ring takes the same road as a person typing the command, so a scheduled run can never do more
than a hand-started one. Checking comes before doing.
```

```flow
source: the clock rings | or a person runs arc-jobs
box: ① Lock | one run of a chore at a time
box: ② Check the rules | the shared policy check
box*: ③ Do the chore | a script with a time limit
box: ④ Write the receipt | one line in the logbook
labels: allowed, ran, then
out: already running | refused, with a receipt
out: rules say no | skipped, and says why
out: -
out+: receipt | the chore is on record
divider: 2 | free to refuse | the chore runs
note: A chore that never ran leaves no receipt. The briefing notices the gap instead.
caption: Figure 1 — one chore, one door. | The dashed line is where checking ends and doing begins.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: The steel thread (phase 00)
plain: Build the thinnest complete version first: the list, the checker, the door and both chores, then attack it.
d: Two fresh reviewers attacked it. They found 24 problems that overlapped on only one, and four would have shipped. The live demo found two more that tests missed.
f: `.claude/scripts/hq/arc-jobs.mjs` · `.claude/scripts/hq/jobs-lint.mjs`

t: The attended heartbeat (phase 01)
plain: Let a person run what is due by hand, and make a chore going quiet show up in the morning briefing.
d: The briefing panel is worked out from the date, the list and the logbook, never from the current clock, so replaying an old date gives the same answer. The hard case was a chore that had never run at all.
f: `.claude/hooks/SessionStart.d/60-jobs.sh`

t: The flip onto the real clock (phase 02)
plain: Hand the list to the Windows Task Scheduler, with a switch to take it back, and refuse to hand over anything if the rules check is failing.
d: The attack found that the weekday time string this lane generated was one the scheduler script refuses. That one bug would have kept every job after it from being registered.
f: `initiatives/scheduler/PROGRESS.md`

t: The proving week (phase 03)
plain: Leave it alone for seven days and count what happened. Then unplug one alarm on purpose and see if the warning appears.
d: Zero manual starts, checked from the logbook and not just claimed. The week restarted once, after a fault made every run after the first do nothing.
f: `initiatives/scheduler/evidence/phase-03/week-log.md`
```

# The bigger loop

## What the week found

```lede
The proving week did its job: it found things nobody had planned for.
```

- **The clock drops missed rings.** Windows keeps only one missed run per chore. On a day the machine was
  off, two slots were missed and only the newer was made up. That is ADR-0807, with the fix decided and not yet built.
- **The success test could not be met.** A powered-off machine writes nothing, so no week with an off day
  could grade clean. The rule stayed strict and the test was reworded to grade each gap by its cause (ADR-0808).
- **A suspect was cleared.** Antivirus was blamed for missing runs. The real cause was an action that only
  made its log folder on its first run, so later runs launched nothing.

## Life of a quiet chore

```loop
top: 1 | the chore list
top: 5 | the briefing
stage: 1 · A chore is due | the clock should ring
stage: 2 · It does not ring | alarm gone, machine off
stage: 3 · Slots pass | nothing is written
stage*: 4 · Gap passes twice the cadence | the panel counts it
stage!: 5 · Needs-you line | the briefing names it
labels: due, silent, counted, warned
back: last -> 1 | someone fixes it and the next ring is on record
caption: Figure 2 — how silence becomes visible. | The warning is worked out from what is missing.
```

1. A chore is meant to ring every weekday morning.
2. Someone unplugs its alarm. The chore list still says it is on.
3. Each morning passes with no receipt.
4. Once more than two slots are missing, the panel counts it as overdue.
5. The briefing prints a line naming the chore and how long it has been silent.

*The steps above are an illustration of how the loop runs. The fire-drill in phase 03 is the real test of it.*

## Where it stands

The live phase, burn and blocker are in the generated sections. In words: phases 00, 01 and 02 are
closed and both chores are registered on the real clock. Phase 03, the proving week, is still running.
It is waiting on elapsed time, not on work: the fire-drill needs a third missed slot before the warning
can fire, and the tracker gives 2026-08-26 as the earliest close.

Effort is nearly spent (2.5 of 3 days), so the fixes from ADR-0807 and ADR-0808 are decided but left
for the next cycle's opening phase. Building them now would be the quiet extension the plan forbids.

What is next: capture the needs-you line, run the gap audit, then close with `/arc-retro`.

## How it connects to the rest of arc

- **Policy.** Every run is authorised by the shared policy check that other lanes use (ADR-0802). This
  lane may not write a second reading of it.
- **The logbook.** Receipts go to the same append-only spine as everything else.
- **The engine.** Chores that call `arc-run` pass through the engine, which refuses chore stubs on purpose.

# Meta

## Glossary

```gloss
spine: arc's append-only logbook of what happened.
receipt: one line on the spine saying a chore ran, and how it ended.
cadence: how often a chore is due, such as weekdays at 06:00.
idempotent: safe to run twice. A second run for the same slot changes nothing.
appetite: the time budget a lane sets itself before it starts.
```
