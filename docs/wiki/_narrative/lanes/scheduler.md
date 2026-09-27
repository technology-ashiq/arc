<!-- facts: appetite=39b40118 blocked-on=39bf1db6 burn=7bd4fb72 cycle=43b10f08 depends-on=a68c9074 hasPlan=b5bea41b phase=0b3aa5a1 status=8ddd7aee title=ae009067 -->

## In plain words

Think of a small company where a few chores have to happen every single day whether or not anyone
remembers — closing yesterday's books, writing the morning briefing. Putting a chore on a clock
instead of trusting memory only helps if someone can glance at that clock each morning and see
whether it actually rang. <!-- plain -->

The lane's own goal: turn every daily arc chore into a receipted, budgeted, policy-checked
headless run — a jobs file in git, one wrapper, the operating system's own scheduler — so arc
stays free of any resident background process, the spine records everything that happens, and
silence itself becomes something visible rather than something nobody notices. <!-- src: initiatives/scheduler/PLAN.md -->

### What it is building

The product is `hq.jobs.yaml` (a git-tracked, closed-schema list of jobs) plus the `arc-jobs`
wrapper that runs them, registers them on the real operating-system scheduler, and writes one
receipt per run — so a chore that used to depend on somebody remembering to run a command now runs
unattended and reports on itself. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->

That mattered because arc deliberately runs no daemon of its own: the operating system's own
scheduler is arc's only timer, and every execution — attended or scheduled — walks the same one
path: lock, guards, execute, receipt, the same as a person typing the command by hand would get. <!-- src: initiatives/scheduler/PLAN.md#resident -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| `hq.jobs.yaml` | The one git-tracked file listing every scheduled chore, parsed by the same closed grammar the engine already uses elsewhere. <!-- src: initiatives/scheduler/PLAN.md -->|
| jobs-lint | The check that refuses a bad job file at commit time — before it can ever run — against a fixed list of hostile shapes. <!-- src: initiatives/scheduler/PLAN.md -->|
| the wrapper | `arc-jobs`, the one path every run walks: lock, guards, execute, receipt. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->|
| slot | The moment a job is due to fire, floored to the nearest scheduled time; it becomes part of the receipt's idem key `<job>@<scheduled_for>`, which is how a repeat firing for the same moment is recognised as a repeat. <!-- src: initiatives/scheduler/phases/phase-00-spec.md -->|
| catchup | Running the jobs that were due while the machine was off or asleep, the next time it wakes. <!-- src: ADR-0804 -->|
| needs-you line | The line the brief prints when a job is overdue more than twice its own cadence, naming the job and how long it has been silent. <!-- src: initiatives/scheduler/phases/phase-01-spec.md -->|
| register / unregister | `register`/`unregister` drive the PowerShell ScheduledTasks module, with every power and logon setting written explicitly rather than inherited; `unregister` turns the whole heartbeat off with one command. <!-- src: initiatives/scheduler/phases/phase-02-spec.md -->|
| POL-D | The one shared policy library every run's authorization check goes through; this lane is forbidden from writing a second one. <!-- src: initiatives/scheduler/PLAN.md -->|

## How the work was planned

The lane's five success requirements, from its plan: <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->

| REQ | What it demands |
|---|---|
| REQ-01 | A job that would misbehave is rejected at commit time, before it can ever run, against at least twelve pinned hostile shapes — bad cadence, an entry outside the jobs folder, a missing budget, a money-spending job, and more. <!-- src: initiatives/scheduler/PLAN.md -->|
| REQ-02 | Every run, whether started by a person or by the scheduler, takes exactly one path and leaves exactly one receipt, with a scheduled run never able to exceed what a manual run of the same kind is allowed. <!-- src: initiatives/scheduler/PLAN.md -->|
| REQ-03 | One command runs everything currently due, and the brief's jobs panel is a pure function of the date, the jobs file and the spine, so replaying an old date reproduces byte-identical output. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->|
| REQ-04 | The heartbeat runs unattended, and turns itself off rather than run unpoliced: `register` exits 2 when policy enforcement fixtures are red. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->|
| REQ-05 | A week of real unattended running, with zero manual starts proven by an actor query on the spine rather than merely asserted, and the silence detector itself proven by deliberately removing one job's OS task. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->|

The appetite was three days of effort, though the elapsed calendar time runs longer since Phase 3
is a real proving week needing at least seven days wall-clock — a constraint the lane treated as
fixed: blowing it means cutting a phase or killing the cycle, never a silent extension. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->

The plan's kill criteria: Phase 0 not green within a day and a half stops the cycle and reassesses,
with the cycle dying while the analysis survives; at half the appetite burnt with Phase 0 still
open, a scope-cut conversation becomes mandatory; at full burn, it is cut or killed, never a silent
extension; and the proving week turning up fewer than two jobs worth scheduling parks the cron
flip, keeps `register` off, and keeps the attended wrapper plus brief panel, since they are already
daily value. <!-- src: initiatives/scheduler/PLAN.md#Appetite -->

The four phases, in the plan's own risk order: a steel thread proving the law and the wrapper core
(1.0 day), the attended heartbeat a person can run by hand (0.5 day), the flip onto the real
operating-system scheduler (0.75 day), and a proving week plus retro (0.5 day of effort against the
proving week's own seven-or-more days of elapsed time). <!-- src: initiatives/scheduler/PLAN.md#Phases; initiatives/scheduler/PLAN.md#Appetite -->

## The phases, one by one

| Phase | Set out to prove | What shipped, and what it cost |
|---|---|---|
| 00 — steel thread | the jobs schema, `jobs-lint` with its hostile corpus, the wrapper's lock→guards→execute→receipt path, both script-jobs, and the `arc-run` job-stub guard | Closed 2026-08-12: the two-surface adversarial pass returned 24 findings overlapping on ONE, and four would have shipped — every close-day failure counted as a sealed day, `roots: ["**"]` passing the self-modification ban, a directory accepted as a script entry, and the branch already CI-red on all three legs; the live demo then found two more: every receipt being rejected as a duplicate while the wrapper still reported success, and a benign double fire being called a lost receipt. Double fires are now prevented, not merely noticed. <!-- src: initiatives/scheduler/PROGRESS.md#BAD_IDEM -->|
| 01 — the attended heartbeat | `run`, `catchup`, `list --next 7`, a read-only startup nudge, and a briefing panel that never disturbs another lane's pinned output | Closed 2026-08-12: the panel is a derivation, not a query, and the hard case was the job that has never run — an early version anchored its missed-slot count at the last slot forever, so a job that had never fired in a month read identically to one just registered; it now measures over the window the spine can actually witness. <!-- src: initiatives/scheduler/PROGRESS.md#derivePanel -->|
| 02 — the cron flip | registering and unregistering against the real Windows Task Scheduler with ADR-0803's five explicit settings, a next-minute smoke test, and a policy gate that refuses to register at all when it is not passing | Closed 2026-08-13: the headline finding was that `registrationFor` emitted a weekday trigger string `scheduler-task.ps1` refuses outright, and since `register` walks enabled jobs in file order with `brief-materialize` first, that one bug would have made the entire unattended surface unregisterable; three green checks had looked straight at the registration path beforehand and none of them caught it. <!-- src: initiatives/scheduler/PROGRESS.md#registrationFor -->|
| 03 — proving week + retro | at least two jobs running unattended for at least seven days, zero manual starts proven by an actor query on the spine, a deliberate fire-drill, a full gap audit, and a retro | Still running as of the tracker's own header: the week had to restart once after a defect made every run past the first a no-op, and the fire-drill needed a third missed slot before the silence detector could fire, pushing the earliest possible close later than first planned. <!-- src: initiatives/scheduler/PROGRESS.md -->|

## What it decided

The lane holds ADR century 0800–0899, and the proving week widened it to 0800–0808: <!-- src: initiatives/scheduler/PROGRESS.md -->

| # | Decision |
|---|---|
| 0800 | The lane claims century 0800–0899 rather than the 0700s the company board had advertised as free. <!-- src: ADR-0800 -->|
| 0801 | The build-out trigger is an owner instruction, and the ADR says plainly that its own receipt is still owed rather than pretending to cite one. <!-- src: ADR-0801 -->|
| 0802 | A job authorizes itself as `process:<name>`, reusing the policy library's already-closed subject set rather than adding a new one. <!-- src: ADR-0802 -->|
| 0803 | Registration goes through the PowerShell ScheduledTasks module, with every power and logon setting written out explicitly rather than left at a default. <!-- src: ADR-0803 -->|
| 0804 | The machine is never woken up just to run a job; a slot missed while it was asleep is caught the next time it wakes on its own. <!-- src: ADR-0804 -->|
| 0805 | The logic for rolling forward several missed days at once lives inside the job itself, because the underlying day-closing tool is not the right place for it. <!-- src: ADR-0805 -->|
| 0806 | Version one ships exactly two script-jobs, and a third job watching an external site is decided against building this cycle. <!-- src: ADR-0806 -->|
| 0807 | The real operating-system scheduler queues at most one missed run per task, so recovering more than one missed slot needs a separate logon-triggered mechanism, decided but not built this cycle. <!-- src: ADR-0807 -->|
| 0808 | A gap in the schedule is graded by its cause, not merely by its absence, because the machine simply being off is not this lane's defect to own. <!-- src: ADR-0808 -->|

## Where it stands now

The tracker reads status live, on phase 03, having burned two and a half of its three-day
appetite. <!-- src: fact:lanes/scheduler.status; fact:lanes/scheduler.phase; fact:lanes/scheduler.burn; fact:lanes/scheduler.appetite -->

The tracker's own header names what it is waiting on: elapsed time — the proving week restarted on
2026-08-17 after a defect made every run past the first a no-op, and the armed fire-drill needs its
third missed slot before the silence detector fires, putting the earliest possible close at
2026-08-26. <!-- src: fact:lanes/scheduler.blocked-on -->

Measured over the week's six finished days, manual starts were zero and spend was zero rupees, as
designed, but two slots on one off day were never made up — the operating system's own scheduler
turned out to queue only the newer of two missed runs and simply drop the older one, which is a
sharper finding than the assumptions-ledger row that first raised the question. <!-- src: initiatives/scheduler/PROGRESS.md#audit.mjs -->

A leading hypothesis for missing runs earlier in the week — antivirus software blocking the job —
was investigated and closed as wrong: the real cause was a registered action that only created its
own log directory on its very first run, so every later run exited cleanly having launched nothing
at all, and nothing was ever actually blocked. <!-- src: initiatives/scheduler/PROGRESS.md#McAfee -->

The lane's appetite position, stated plainly: this cycle cannot afford its own remedy — ADR-0807's
logon trigger and ADR-0808's downtime classification are real build work, and building them inside
the remaining time would be the silent extension the kill criteria forbid, so both ADRs are
recorded as decisions with implementation deferred to the next cycle's opening phase. <!-- src: initiatives/scheduler/PROGRESS.md#deferred -->

## The bigger loop

### What went wrong and what was learned

The two-surface adversarial pass on the steel thread found twenty-four holes overlapping on only
one, and a live demo afterward found two more that the unit tests alone could not have caught: every
receipt was being silently rejected as a duplicate while the wrapper still reported success, and a
harmless repeat firing was being called a lost receipt when it was not one. <!-- src: initiatives/scheduler/PROGRESS.md -->

Building the silence detector taught the lane that the hardest case is not a job that fails loudly
but a job that has simply never run: an early version measured missed slots from the last slot it
had ever seen, which reported a job silent for a month as identical to a job that had just started
— exactly the failure the detector exists to catch, hiding behind its own arithmetic. <!-- src: initiatives/scheduler/PROGRESS.md#derivePanel -->

`scheduler-task.ps1` refused the exact trigger string this lane's own code generated for a weekday
job, and because registration walks every enabled job in file order with `brief-materialize` first,
that one bug would have silently blocked every job listed after it from ever being registered at
all. Three separate green checks looked directly at the registration path beforehand and none of
them caught it: the real-OS smoke test hand-typed its own trigger and never went through
`registrationFor`, the contract test pinned the bug by asserting the wrong string back, and every
other test exercised only the daily job. <!-- src: initiatives/scheduler/PROGRESS.md#registrationFor -->

The proving week's own exit criterion turned out to be unreachable: `audit.mjs` accepts an
explanation only from actor `scheduler:<job>`, and a powered-off machine emits nothing, so no
window containing an off day could ever grade CLEAN. The strict actor rule stayed exactly as
written — it is what stops a hand-written note from grading a dead scheduler clean — and the
criterion for a clean week was the part that changed: it now reads every gap classified, zero gaps
in the class of arc running while the job did not fire, recorded as ADR-0808. <!-- src: initiatives/scheduler/PROGRESS.md#audit.mjs -->

### How it connects to the rest of arc

Every run this lane makes, attended or scheduled, is authorized through the same shared policy
library every other lane uses, and this lane is expressly forbidden from writing any second reading
of that policy for itself. <!-- src: initiatives/scheduler/PLAN.md -->

Money-touching jobs are refused outright by this lane's own commit-time check, on top of whatever
the shared policy library would already refuse, so scheduling can never become a quiet side door
around the company's spending rules. <!-- src: initiatives/scheduler/PLAN.md -->

## Glossary

- **hq.jobs.yaml** — the single git-tracked file naming every scheduled chore. <!-- src: initiatives/scheduler/PLAN.md -->
- **jobs-lint** — the commit-time check that refuses a hostile or malformed job before it can ever
  run. <!-- src: initiatives/scheduler/PLAN.md -->
- **the wrapper** — `arc-jobs`, the single path every run takes: lock, guards, execute,
  receipt. <!-- src: initiatives/scheduler/PLAN.md#arc-jobs -->
- **catchup** — running the jobs that were due while the machine was off, the next time it wakes. <!-- src: ADR-0804 -->
- **needs-you line** — the brief's way of surfacing a job that is overdue more than twice its own
  cadence, naming it and how long it has been silent. <!-- src: initiatives/scheduler/phases/phase-01-spec.md -->
- **register / unregister** — driving the PowerShell ScheduledTasks module directly, with every
  power and logon setting written explicitly rather than inherited. <!-- src: initiatives/scheduler/phases/phase-02-spec.md -->
- **fire-drill** — removing a job's operating-system task while `hq.jobs.yaml` still reads
  `enabled: true`, to prove the needs-you line actually appears. <!-- src: initiatives/scheduler/phases/phase-03-spec.md -->
