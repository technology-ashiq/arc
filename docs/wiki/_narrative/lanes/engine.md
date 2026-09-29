<!-- facts: appetite=5e9c2398 blocked-on=a68c9074 burn=3211e87a cycle=8438563e depends-on=a68c9074 hasPlan=b5bea41b phase=991629d8 status=4c1abf59 title=ffe7e065 -->
```tagline
The dispatch office. Every job arc hands to an AI worker goes through it, and its latest cycle
signed the first outside contractor under the same rules as the in-house staff.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI workers. Something has to decide who gets each job,
hand the job over, cap the money, and write a receipt when it is done. That something is **the
dispatch office**, and the engine lane is the workstream that builds it.

A job is written once, as a plain job description (a process file). It names no worker. The office
looks up who is on the rota (`engine/router.yaml`), sends the job to that worker through a small
adapter (a driver), checks the answer against the shape the job description demanded, and files a
receipt.

```panel big
**The office treats every worker the same way.** In-house staff and an outside contractor get the same money cap, the same clock, the same answer check and the same receipt. The lane's latest cycle, "The Hired Hands", proved that with a real contractor doing real work.
```

### What this lane is for

Without an office, each job would be wired to one worker by hand, and swapping a worker would be a
rewrite. The lane exists so a worker can be added, tried, capped or removed without touching the jobs.

The lane's plan (`initiatives/engine/PLAN.md`) states the goal for this cycle: run an arc process on one
external agent runtime (Hermes Agent) under the same contract as every other driver, and leave behind
a reusable hiring kit, so the second outside hire is a checklist and not a project.

### Why the last cycle looked the way it did

The cycle before it shipped the office but its central claim went unproven. It had asked for three real
runs on a non-Claude worker and got none, because nothing runnable was installed and no key existed.
The plan says so in its first lines: this cycle inherits that gap, not a green row.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary staffing-agency thing wearing a technical name.
```

```rosetta
process | a job description | one YAML file with the answer shape it must return; names no worker
driver | the adapter for one worker | knows how to call a CLI, an API, or an outside agent runtime
`engine/router.yaml` | the staff rota | says which worker holds which job
hire row | the employment contract | a rota row for an outside runtime; carries a cap, a place, a judge and an end date
tenure (`review_by`) | the contract end date | past it, the row refuses to dispatch until someone re-justifies or retires it
context pack | the folder handed to the contractor | owner-approved; bounds what data a job may see
capped key | the contractor's own wallet | a credential whose spending ceiling is fixed before it is issued
data boundary | "may this leave the building?" | refuses internal-only input before the worker starts
```

## How one job is handed out

```lede
The office checks before it spends. Nothing starts without a cap, a clock and a worker on the rota,
and every ending, good or bad, leaves a receipt.
```

```flow
source: arc-run --process X
box: ① Read the job | description + input
box: ② Pick the worker | from the rota
box: ③ Hand it over | through the driver
box*: ④ Check the answer | shape + secrets scan
labels: found, sent, returned
out: bad row | refused before any spend
out: -
out: -
out: wrong shape | one retry, then a proposal to a person
out+: receipt | one line in the logbook
divider: 2 | free to refuse | money is spent
note: A failed run never quietly changes a worker. It ends in a proposal for a person to read.
caption: Figure 1 — one dispatch. | The dashed line is where the office starts spending real money.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Read the job and the rota
plain: The job description says what is wanted and what shape the answer must take. The rota says who does it. A contract row with a missing term, or one past its end date, is refused right here.
d: Tenure is enforced when the router loads, not only when a row is used (ADR-0216). A process is one YAML file with a schema contract (ADR-0200).
f: `engine/router.yaml`

t: Hand it over through the driver
plain: The driver is the only part that knows how to talk to that worker. The office sets the clock for the whole run, not for each try, so a slow worker cannot stretch it.
d: A driver has three exit codes and the interface is fixed (ADR-0203, ADR-0219). Wall-clock belongs to the run (ADR-0210).
f: `.claude/scripts/engine/arc-run.mjs`

t: Keep the contractor in its own room
plain: An outside worker gets a fresh private copy of its home folder each time, sees only the pack the owner approved, and spends from a wallet with a hard ceiling.
d: The runtime cannot switch its own memory off, so each dispatch gets a private copy (ADR-0222). Packs bound data, not the angle taken (ADR-0214). The ceiling is the credential (ADR-0213).
f: `.claude/scripts/engine/drivers/hermes.mjs`

t: Check the answer and file the receipt
plain: The answer must match the promised shape and is scanned for secret-looking text. Then a receipt goes on arc's logbook. Publishing stays a person copying text out.
d: Drafts are scanned like logs and a scrubbed transcript is kept (ADR-0215). arc checks outcomes and never prescribes how the contractor works inside (ADR-0218).
f: `initiatives/engine/evidence/`
```

# The bigger loop

## Hiring, as a loop

```lede
A hire is not forever. It starts with an owner decision, works for a while, and ends with an owner
decision again.
```

```loop
top: 1 | a need
top: 5 | the review
stage: 1 · Owner approves | a written decision
stage: 2 · Row on the rota | cap, place, judge, end date
stage*: 3 · Real jobs run | receipts on the logbook
stage: 4 · Owner judges | accept or reject, with a reason
stage!: 5 · End date arrives | renew or retire
labels: hire, dispatch, verdict, tenure
back: last -> 1 | a lapsed row stays refused until someone decides
caption: Figure 2 — the life of a hire. | Every step leaves a written trace.
```

1. The owner decides in writing that an outside worker may be tried.
2. A rota row names the runtime, its cap, where it runs, who judges it, and when it expires.
3. Real jobs run on owner-approved packs. Each leaves a receipt.
4. The owner reads each draft itself, not a report about it, and records accept or reject with one line of why.
5. When the end date passes, the row refuses to dispatch until someone re-justifies or retires it.

*This loop is an illustration of the hire's life. It is not a real result.*

## Where it stands

The tracker (`initiatives/engine/PROGRESS.md`) holds the live status and burn in the generated sections.
In words: the Hired Hands cycle finished all its phases, and its real jobs came back with receipts,
some drafts accepted and one rejected, each with a reason. The lane is quiet, not stopped.

The hire itself lapsed on purpose. Its one job is the process `build-in-public-draft` (a first-draft writer for public posts). Its contract end date passed, the row now refuses to dispatch, and
on 2026-09-15 the owner ruled the decision stays deferred, neither renewed nor retired.

Work has kept landing since the cycle closed, each piece routed through `/arc-change`. Two examples,
both in the tracker. The PR loop's attacker pass and CI read became governed engine work (ADR-0226,
run with `/arc-attack`). And a driver that ignored the run's clock, which once let an attack run for
about an hour and a half with no result, was fixed, together with a small schema addition (ADR-0227).
Leftover small findings from that fix sit in `initiatives/engine/debt-ledger.md`.

What is next is the owner's call: renew the contractor, retire it, or leave it lapsed.

## How it connects to the rest of arc

- **The bench lane.** Bench trials new models through the per-run trial seam that engine owns
  (ADR-0220). Engine builds the runner; bench decides nothing and only proposes.
- **The face lane.** A face attack running through `generic-api` is what exposed the clock bug.
- **The logbook and inbox.** Every dispatch lands its receipt on the same append-only logbook as every
  other lane.

# Meta

## Glossary

```gloss
appetite: the time budget for a phase or a cycle. In this cycle it moved only by written owner ruling.
burn: how much of the appetite has been used, counted in working days.
receipt: one line on arc's logbook saying a run finished and what it cost.
out-of-cycle: work done after a cycle closed, routed through the change process and charged to no budget.
```
