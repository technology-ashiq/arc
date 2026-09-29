<!-- facts: appetite=e02f5370 blocked-on=a68c9074 burn=7d7c121a cycle=7a015a98 depends-on=a68c9074 hasPlan=b5bea41b phase=3a417c07 status=4c1abf59 title=373b4406 -->
```tagline
The lane that built the site foreman. It makes sure that when an AI builds a phase of arc, the work
arrives in small pieces, each one checked, and what went wrong last time is written down for next time.
```

# Start here

## In plain words

Think of arc as a building firm that also builds its own tools. A phase of work is one whole room of a
house. The room used to be built in one long stretch, with nobody standing over it. Whether it came out
right depended on the builder remembering to be careful.

**The develop lane is the site foreman.** Its job is to hand the builder one small, approved job at a
time, ask for proof before the next job starts, and blow the whistle if the builder is going round in
circles. The foreman is a command, `/arc-develop`, and this lane is the workstream that built it
(`initiatives/develop/PLAN.md`).

```panel big
**What the foreman does, in four moves:**

- **Briefs the builder.** Before any job, a sheet is handed over: what was asked, what must not be broken, and what else the change might touch.
- **Asks for proof.** A job is not "done" until it has a note saying how it was proven. A job with no proof note is refused.
- **Stops the grinding.** The same mistake three times in a row means stop and find the root cause. Five tries on one job means call the owner.
- **Writes it down.** When something goes wrong that nobody caught, it goes in a notebook, so the next room is built better than the last.
```

### Why this needs a lane at all

The plan says the goal is a harness that gets "measurably better run" each phase "from a record rather
than from memory" (`initiatives/develop/PLAN.md`). A lane is one workstream of arc's own building, with
its own plan and its own progress file. This one was big enough to need both.

## arc words → normal words

```lede
Eight bits of jargon this lane uses. Each is an ordinary site-office thing with a technical name.
```

```rosetta
slice | one small job inside a phase | each has to be proven before the next starts
proof note | the line saying how a job was checked | a slice without one is flagged `slice-unproven`
Build Brief | the briefing sheet at the start | what was asked, what must not break, what it may touch
stuck | the foreman noticing the builder is going in circles | three identical failures force a root-cause look
checkpoint | a pause when a change touches risky ground | chosen by a table of risky paths, never by the builder's own say-so
learning row | one written-down mistake nobody caught | lives in `docs/develop/learning-ledger.md`
holdout | test cases kept back from whoever writes a new safeguard | so the safeguard cannot be shaped to fit them
vetting | checking a new tool before it is let onto the site | refused by default until its origin is known
```

## How one phase runs with the foreman

```lede
The foreman has five moves. They are what `/arc-develop` offers, in the order a phase uses them.
```

```flow
source: an approved phase
box: ① Start | brief handed out
box: ② Next | one slice, with context
box*: ③ Prove it | note + one commit
box: ④ Hand off | fresh reader checks
labels: brief, slice, proven
out: no proof note | the slice is refused
out: same failure x3 | stop, find the root cause
out: five tries | escalate to the owner
out: risky path touched | pause at a checkpoint
divider: 3 | building | checking
note: The foreman never commits for the builder. The session does, once per proven slice.
caption: Figure 1 — one phase under the foreman. | The dashed line is where building ends and someone else checks it.
```

```steps
t: The brief goes out
plain: Before a single line is written, the builder gets the briefing sheet: the asked-for outcomes, the things that must not be broken, and a rough guess at what the change will touch.
d: `/arc-develop start` writes the phase's brief and a task file from the approved phase spec.
f: `.claude/commands/arc-develop.md`

t: One job at a time, with the notes of the past
plain: The builder is shown what earlier work already knows about this job, such as decisions that govern it and mistakes made near it, then builds just that one job.
d: `next` prints a context pack made from the code around the change, the decisions that apply, and the notebook rows linked to it.
f: `.claude/scripts/develop/context-pack.mjs`

t: The job is proven or it does not count
plain: Each job carries a note saying how it was proven and how strongly. A tidy checker reads the notes and refuses any that are empty.
d: `develop-lint` blocks a ticked slice with a missing proof note. The session makes one local commit per proven slice (ADR-0102).
f: `.claude/scripts/develop/develop-lint.mjs`

t: A fresh pair of eyes at the end
plain: A reader who has seen only the spec and the finished change is asked one question: is this what was asked for? They look for drift and extra scope.
d: `handoff` calls the `spec-fidelity` agent, which reads only the phase spec and the diff.
f: `.claude/agents/spec-fidelity.md`
```

# The bigger loop

## The notebook of mistakes

```lede
The lane's second job is memory. A mistake that slipped through once should be findable next time.
```

When something escapes, it is written as a learning row: what failed, why it was missed, what would
have prevented it, and links to the decisions and phases involved (`docs/develop/learning-ledger.md`).
A safeguard someone proposes is then tried against old failures kept as test cases. A fresh agent
grades the proposal, not the author (ADR-0108). The holdout cases are chosen before any proposal is
written, and that rule is kept by process, not by cryptography (ADR-0109).

Two scouts help too. `capability-scout` looks for tools the build lacks, and `/arc-capability` is how a
session asks. `pattern-miner` looks for how others solved the same design question. Nothing gets in
without vetting, and the vetting judges where a tool came from, not how popular it is (ADR-0110).

```loop
top: 1 | the mistake
top: 5 | the safeguard
stage: 1 · Escaped | a mistake nobody caught
stage: 2 · Written down | a learning row
stage*: 3 · Tried on old cases | a fresh agent grades it
stage: 4 · Owner decides | approval, not a streak
stage!: 5 · Enforced | a check that can fail
labels: record, propose, judge, promote
back: last -> 2 | if a check is refused, the row says what to try next
caption: Figure 2 — from a slipped mistake to an enforced check. | The owner's yes is one of three inputs needed, never the only one.
```

## A short story (an illustration)

This is the lane's own story, told in the plan's words. The first plan claimed the work was complete.
Five things had no owner: one phase pushed them to a later phase and that phase pushed them back. A
fresh attacker spotted it. The owner chose to fund the gap rather than accept it. The time budget went
up from 5 days to 7 and a new phase was added (`initiatives/develop/PLAN.md`).

Later, a promotion was tried twice and refused twice, and the record says the goal was not reworded to
fit (`initiatives/develop/PROGRESS.md`). That refusal is the foreman doing its job on itself.

## Where the lane stands

The tracker header reads `IDLE`: the second cycle is closed and merged, with 2.1 of the 7 days used
(`initiatives/develop/PROGRESS.md`). The generated facts above carry the exact numbers, so they are not
repeated here.

What is still owed, from the tracker:

1. **One real promotion is unproven.** Both attempts were rejected, and the ledger says what a third must do differently.
2. **A few honest shortcuts are on the debt list** (`initiatives/develop/debt-ledger.md`), each with the moment it should be paid.
3. **One piece was left out on purpose**: checkpoints that judge a screen's design. There was no screen work to try them on, and the plan refuses to build a gate that has never fired.

To start another build under the foreman, `/arc-kickoff` opens a plan and `/arc-phase-done` closes a
phase once its proof exists.

# Meta

## Glossary

```gloss
lane: one workstream of arc's own building, with its own plan and progress file.
phase: one whole piece of a lane's plan, closed only when its proof exists.
appetite: the amount of time a phase is allowed to take before the plan forces a talk.
escalate: hand the problem to the owner instead of trying again.
```
