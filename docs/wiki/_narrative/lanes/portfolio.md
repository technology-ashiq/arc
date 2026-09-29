<!-- facts: appetite=39b40118 blocked-on=a68c9074 burn=ea4d8a49 cycle=65040f77 depends-on=a68c9074 hasPlan=b5bea41b phase=3bd5956c status=4c1abf59 title=b146a689 -->
```tagline
The lane that taught arc to run many projects at once. Each project gets its own room and its own
plan, and one noticeboard shows them all.
```

# Start here

## In plain words

Think of arc as one office building. Before this lane, the building had **one meeting room** and one
whiteboard. Only one project could use it at a time. If that project got stuck waiting for the owner,
every other project waited behind it, even ones that never needed the owner for anything.

**portfolio is the lane that built more rooms.** Each project now has its own room, with its own plan
and its own progress sheet. A single noticeboard in the lobby shows which rooms are busy.

```panel big
**The noticeboard is a view, not the truth.** `PORTFOLIO.md` copies its values from each room's own progress sheet. If the board and a room disagree, the room wins (ADR-0051). Nobody edits a value on the board and calls it done.
```

### What this lane is for

The plan (`initiatives/portfolio/PLAN.md`) states the goal as arc gaining "The Conductor". Several
products can plan and build in parallel, while arc stays one company: one machine, one main branch,
one test system, one logbook, one owner.

It also made a promise to every project that uses arc but has no rooms: their layout stays exactly as
it was, forever. That is called root-mode, and it is a permanent promise, not a stopgap.

## arc words → normal words

```lede
Six pieces of arc jargon. Each is an ordinary office thing wearing a technical name.
```

```rosetta
lane | one project's own room | a folder at `initiatives/<lane>/` holding that project's plan, progress sheet, phases and evidence
--lane | the only way to name a room | a bare word after a command is never read as a room name
root-mode | the old single-room building | used whenever there is no `initiatives/` folder; behaves exactly as before
machine header | the sign on the room door | a few fixed lines at the top of a lane's `PROGRESS.md`: status, cycle, phase, appetite, burn
eligible | counts as busy | a lane whose status is LIVE or BLOCKED; the count is shown, never used to stop anyone
Mode B | two people in two rooms at once | a real `git worktree` per lane; not certified today
```

## How a command finds its room

```lede
The rule is never guess. If the choice is not obvious, the command asks and stops.
```

```flow
source: /arc-* command, with or without --lane
box: ① Room named? | --lane given
box: ② Any rooms? | initiatives/ exists
box: ③ One busy room? | LIVE or BLOCKED
box*: ④ Go | work in that room
labels: named, rooms exist, exactly one
out: unknown name | STOP, create nothing
out: no folder | root-mode, as before
out: none or many | ask, never pick
out+: room chosen | its own plan and progress
note: Only /arc-kickoff may create a new room. Every other command refuses an unknown one.
caption: Figure 1 — how a lane-aware command picks its room. | Steps 1 to 3 only read; nothing is written until a room is chosen.
```

## What it built

```lede
Each piece is written twice: first in ordinary words, then what it is in the repo.
```

```steps
t: The rooms themselves
plain: One folder per project, each holding that project's plan and progress. The folders are named in lower case with dashes. The old evidence and archive stay frozen where they were, and rooms link to that history instead of copying it.
d: Lanes live at `initiatives/<product>/` (ADR-0050). Evidence lands per lane going forward and older evidence stays frozen (ADR-0055). History is linked, never copied (ADR-0058, amended by ADR-0062).
f: `initiatives/portfolio/`

t: The door-finder
plain: One small program that every lane-aware command asks "which room am I in?". It exists in two matching versions, one for shell and one for Node.
d: Explicit `--lane`, else auto-resolve when exactly one lane is eligible, else ask (ADR-0054). The later develop lane reuses it unchanged (ADR-0105).
f: `.claude/scripts/core/lane-resolve.sh` and `.claude/scripts/core/lane-resolve.mjs`

t: The noticeboard
plain: One page that lists every room with its status, and shows how many rooms are busy. The count is information only. It never blocks starting new work.
d: Statuses are LIVE, BLOCKED, QUEUED, IDLE (ADR-0052). A board row exists only for a lane that already exists (ADR-0061). Ventures appear as passport rows, never as lanes (ADR-0059).
f: `PORTFOLIO.md`

t: Two watchers
plain: One watcher checks that the noticeboard still matches the doors. The other warns when work in one room touches files that belong to another. Both warn first and do not block.
d: The ownership check reads the existing `products/*/manifest.json` files instead of a second list (ADR-0057).
f: `.claude/scripts/core/board-lint.sh` and `.claude/scripts/core/ownership-lint.sh`

t: One tool for status changes
plain: Changing a lane's status now updates its door sign and its board row together, in a single commit, so the two cannot drift apart.
d: Added later by face v2 (ADR-1343), following the one-commit rule of ADR-0051.
f: `.claude/scripts/core/lane-status.mjs`
```

# The bigger loop

## A day with two rooms

```lede
The point of the lane, told as one small story.
```

```loop
top: 1 | a project is stuck
top: 5 | the board
stage: 1 · Room A waits | needs the owner
stage: 2 · Board: BLOCKED | the reason sits beside it
stage: 3 · Room B carries on | its own plan
stage*: 4 · Owner answers A | a command names --lane A
stage!: 5 · Board updated | from A's door sign
labels: waits, shown, carry on, answered
back: last -> 1 | the next stall is just as harmless
caption: Figure 2 — one stuck project, no stuck company. | The board only ever repeats what the doors say.
```

1. Room A needs a decision only the owner can make.
2. Its door sign says BLOCKED, and the board repeats it.
3. Room B keeps going, because it never shared A's whiteboard.
4. The owner answers, and the next command says `--lane` so nothing guesses.
5. The door sign changes, and the board follows.

*This story is an illustration of how the loop runs. It is not a real event.*

## Where it stands

The lane's own progress sheet (`initiatives/portfolio/PROGRESS.md`) says the building cycle is
**closed**. Its four phases are done, and the lane is now idle. The live status, budget and burn are in
the generated sections of this page.

Three things it left open, in its own words:

- **Mode B is not certified.** It was certified briefly, then withdrawn. The certification rested on
  tests for a logbook-spooling piece that had to be reverted after a hostile-input pass found
  data-loss defects in it (ADR-0056). Two writers at once stay forbidden.
- **The ownership watcher has known wrong answers** that the sheet lists as the first thing to fix
  next cycle.
- **One more board check** was accepted but not yet built.

Next, per the board: start the next cycle with `/arc-kickoff --lane <name>`.

# Meta

## How it connects to the rest of arc

- **Every later lane.** The rulebook `.claude/rules/lanes.md` restates this lane's resolution order and
  never-guess rule for every session that touches a lane.
- **Company organs stay single.** The logbook, approval inbox, ADR ledger, retro-log and central tests
  are shared by all lanes and never split per lane (ADR-0053).

## Glossary

```gloss
initiatives/: the folder holding every project's room.
PLAN.md and PROGRESS.md: a lane's plan, and its running progress sheet with the door sign on top.
appetite and burn: the days budgeted for a piece of work, and the days actually used.
WARN-first: a check that reports a problem but does not stop the work, until it has earned trust.
git worktree: a second working copy of the same repository, so two sessions do not step on each other.
```
