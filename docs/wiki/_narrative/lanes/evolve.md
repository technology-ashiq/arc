<!-- facts: appetite=e02f5370 blocked-on=a68c9074 burn=ddae603d cycle=c874db40 depends-on=a68c9074 hasPlan=b5bea41b phase=bc06d26d status=4c1abf59 title=d33ff90e -->
```tagline
The test kitchen for arc's own parts. A new version of a part competes with the current one on
evidence, and evolve can only suggest the swap. A person signs it.
```

# Start here

## In plain words

Think of arc as a restaurant. Its parts (called modules) are the dishes on the menu. Each one was
written once, and after that it changes only when somebody remembers to fix it, by hunch.

**evolve is the test kitchen next door.** It keeps a weekly scoreboard of how each dish is doing. It
lets a new recipe cook against the house recipe on a small, fenced-off set of orders. It marks both on
one fixed rule. If the new recipe clearly wins, it writes a note: "swap this one in".

```panel big
**evolve never changes the menu.** It may only *propose*. A person reads the note and merges the change. That is true even when the change is an undo: putting a bad recipe back also waits for a person. (An illustration: the kitchen can slide a card under the manager's door, but it has no key to the menu board.)
```

### What this lane is for

Without a test kitchen, a module changes when someone feels like it, and nobody can say afterwards
whether it got better. A change that made things worse can sit there unnoticed.

The lane's goal, from its plan (`initiatives/evolve/PLAN.md`), is that a module improves on evidence and
nothing ever changes without a human merge, not even a rollback. There are three parts: scoreboards,
bounded head-to-head experiments, and proposals with a statistical bar they must clear.

### Built ahead of its trigger

The design behind this lane said it should sleep until a real venture had four weeks of real results
to learn from. When the lane started, the plan checked and found that condition unmet: no client was
named and the receipt for a metric did not exist yet. The owner was shown this and told the build to go
ahead anyway. ADR-0300 records that decision. So the engine was built and proven on **practice data
only**. It has never run on anything real.

## arc words → normal words

```lede
Some arc jargon, each one an ordinary kitchen thing wearing a technical name.
```

```rosetta
module | a dish on the menu | one part of arc that could be improved
champion / challenger | the house recipe and the new recipe | the two sides of one experiment
surface | the one recipe card you may touch | the files a module has declared open to experiments
the board | the weekly scoreboard | every module's honest state, built only from the logbook
spine | arc's append-only logbook | evolve's board and experiments are all read from it
receipt | one line in the logbook | each step of an experiment writes one
seal | a photo of the recipe card on day one | if the card changes mid-test, the test is thrown out
verdict | the judges' single ruling | only one pinned statistical test may give it
propose-only | the card under the door, no key | a person always makes the merge
lineage | the paper trail from the idea to the dish on the menu | four checked steps, one file fingerprint each
```

## How a trial goes

```lede
Every step leaves a line in the logbook, and the one step that changes the real menu belongs to a person.
```

```flow
source: a module declares its surface
box: ① Open | fenced-off test
box: ② Assign | same order, same recipe
box: ③ Judge | enough orders, one test
box*: ④ Propose | a person merges
labels: sealed, measured, verdict
out: file changed | thrown out
out: too few orders | no verdict
out: bar not cleared | closed, nothing proposed
out+: proposal | waits for a person
divider: 3 | machine only | person decides
note: The machine never writes the real file. It writes a proposal and stops.
caption: Figure 1 — one experiment. | The dashed line is where the machine stops and a person starts.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: A module opens its surface
plain: A module names, in its own manifest, which files an experiment may touch and which measures count. A module that names nothing is left alone.
d: This is the `evolve` section of a product `manifest.json`, checked by `product-lint`. It is strict from the day it exists, and a file that touches money is refused for good (ADR-0301).
f: `docs/adr/0301-evo-a-evolve-manifest-contract-strict-from-birth.md`

t: The board shows the truth
plain: The weekly scoreboard is drawn from the logbook only. Wipe it, replay the logbook, and you get exactly the same board back. Where there is not enough evidence, it says so instead of guessing.
d: `arc-evolve board` folds the logbook into one status per module.
f: `.claude/scripts/evolve/board.mjs` · `.claude/scripts/evolve/arc-evolve.mjs`

t: An experiment is fenced and sealed
plain: Each order goes to the same recipe every time it is replayed. The split is fixed before the test starts. The recipe card is photographed on day one, and if it changes mid-test, the test is closed.
d: The two sides are tagged `+champion` and `+challenger-a`. There is a time limit and a cap on how many run at once.
f: `.claude/scripts/evolve/assign.mjs` · `.claude/scripts/evolve/wire.mjs`

t: One test gives one ruling
plain: A verdict exists only after both sides have enough orders, and it is computed once. The bar is deliberately high, so a lucky streak cannot win.
d: The pinned test is `newcombe-wilson-difference-v1`, with no second formula allowed behind the same name (ADR-0306). Its reference answers were worked out by two agents independently before any code existed, and ADR-0311 records how "exactly the same" was pinned down.
f: `.claude/scripts/evolve/verdict.mjs`

t: A winner becomes a proposal, never a change
plain: The proposal carries a paper trail that must not break at any of four steps. If the real file drifts later, the surface is frozen and a person is asked. The machine does not write the undo.
d: Four fingerprint checks link the diff, the proposal, the merge and the watch window. Each has a test proving it can refuse, not only pass (ADR-0305).
f: `.claude/scripts/evolve/lineage.mjs`
```

# The bigger loop

## A trial, as a story

```lede
An illustration, not a real run: nothing has yet run on a real surface.
```

Suppose a module's reply template is the house recipe, and a new template is the challenger. The module
declares that one file is open. evolve seals it and starts sending each order to one side or the other.
When both sides have enough orders, the one pinned test rules. If the challenger clears the bar,
evolve files a proposal and stops. A person merges it, or does not. If the merge happens, a watch window
follows, and if things then get worse, the surface freezes and a person is asked to revert.

```loop
top: 1 | a module opens a surface
top: 5 | the menu
stage: 1 · Open and seal | declared file, photographed
stage: 2 · Assign | same order, same side
stage: 3 · Judge | one pinned test
stage*: 4 · Propose | note under the door
stage!: 5 · Person merges | or says no
labels: sealed, marks, ruling, answer
back: last -> 1 | a no, or a later slip, becomes the next experiment
caption: Figure 2 — one experiment's whole life. | Even an undo goes through step 5.
```

## What was built and what was learned

The plan split the work into five phases, ordered by risk, and the tracker
(`initiatives/evolve/PROGRESS.md`) records all five as closed on 2026-08-04. They are: the contract
and one receipt end to end, the board, the runner and verdict maths, promotion safety, and a bridge
for the council product to measure its own jurors. That last phase was named at kickoff as the one to
cut if time ran short. It was built anyway, so the cycle used its whole seven-day appetite with no
slack.

Each phase was attacked by a fresh agent, and every time it found real holes in code that had already
passed its author's own tests (the tracker gives the totals). Some holes were in the tests
themselves. In Phase 03 the weak test was the one guarding the lane's most important rule, propose-only.
A hole fixed in one file was found again one phase later in its twin, which is why the retro added a
rule to carry the list of already-fixed defects into the next attack.

## Where it stands

The lane's status, burn and cycle are in the generated sections. In words: the cycle is closed, and
the tracker calls the result **fixture-proven, unexercised**. Every requirement was measured against
a practice-data test, and none needed real traffic, so none was weakened to pass. What is not claimed is
the north star: the first real experiment on a chosen surface was cut and banked.

The tracker also carries six debts, each with its own pay-down trigger. The one it calls most
important: `lineage.mjs` has no production caller yet, so any default inside it is one the first real
caller will inherit without choosing. And from 2026-08-07 the tracker holds an open question for this
lane from the `policy` lane: ten of evolve's event kinds sit in a catch-all in the daily brief
(`.claude/scripts/hq/arc-brief.mjs`) because nobody has decided which section each belongs in. Nothing
is dropped, but they cannot be ranked yet.

What is next: a real client must name a surface. The `metric.observed` receipt now exists, because
the `leads` lane shipped it as the first client (ADR-0408), but the four-week clock has not started,
because leads has not made its first real send. Until then this engine waits.

## How it connects to the rest of arc

- **The spine and inbox.** Every receipt lands on the same logbook as every other lane, and proposals
  go to the approval queue for a person.
- **The council product.** The last phase lets the council measure its jurors from typed receipts
  (`council-calibrate`), and an unresolved outcome is left out rather than scored as a miss.
- **The leads lane.** It is the first client, and it owns turning on `metric.observed` (ADR-0308).

# Meta

## Glossary

```gloss
fixture-proven: shown to work on prepared practice data, not yet on real traffic.
surface: the specific files a module has said an experiment may change.
appetite: the fixed number of days the lane was allowed to spend, 7 here.```
