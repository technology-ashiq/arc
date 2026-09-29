<!-- facts: appetite=14bbbb4c blocked-on=a68c9074 burn=3ca702d4 cycle=16508e91 depends-on=a68c9074 hasPlan=b5bea41b phase=f12268d3 status=4c1abf59 title=a9279ac5 -->
```tagline
The lane that made arc's reference book print itself. Every product, lane and rule gets a page the day
it is born, and CI refuses a build where the book and the repo disagree.
```

# Start here

## In plain words

Think of arc as a big office building. Every department keeps its own paperwork. Someone once wrote a
staff directory and pinned it in the lobby. New departments moved in, old ones closed, and the directory
went a little more wrong every month. Nobody could say which page to trust.

**The docs lane is the building registrar who prints the directory fresh from the real doors.** It walks
the actual repo, lists what really exists, and prints a page for each thing. A second check compares
the printed book with the building in both directions: a door with no page fails, and a page with no
door fails. Names are given, so the fix is obvious.

```panel big
**The book is never edited by hand.** The facts on every page are printed by a script from the repo. People write only the "explain it in plain words" part, and a page with no explanation says so out loud instead of hiding it.
```

### What this lane is for

Its plan (`initiatives/docs/PLAN.md`) says the goal in one line: something born on Monday is documented
on Monday, before anyone writes a word about it, and the old hand-kept overview documents stop giving
second answers. Without it, the reference book decays quietly, and you only find out when a question
it cannot answer arrives.

### What it built

- **An extractor** that reads the repo through one shared reader, the same one the face app uses, so the wiki and the face can never disagree about what exists.
- **A coverage check** that was built and proven on hand-made fake trees before any page-drawing code existed, so it could not be shaped around real pages.
- **A renderer** that draws `docs/wiki/`. CI redraws it and fails on any difference, so nobody can hand-edit a generated page.
- **Two more checks**, one that blocks and one that warns, for pages that go out of date (see the rosetta below).
- **A clear-out of the old overlap.** The four hand-kept overview documents were archived whole and replaced by short pointers to the wiki.

## arc words → normal words

```lede
Nine pieces of arc jargon. Each is an ordinary registrar's-office thing wearing a technical name.
```

```rosetta
`wiki-build` | the printing press | reads the repo and draws every generated page
`wiki.json` | the master ledger | every fact the press found, in one file, never edited by hand
`wiki-coverage` | the two-way headcount | fails on a thing with no page and on a page with no thing
`wiki-drift` | "this no longer exists" alarm | blocks a page that names a file, command or decision that has gone
`wiki-stale` | "this has moved on" nudge | only warns when the facts under a page changed
narrative | the plain-words part | the hand-written explanation under the printed facts
`narrative-anchors` | the page-shape gate | checks every name a narrative uses is real, and counts pages the owner has not read
explanation debt | the "not explained yet" count | how many things still have no plain-words page
ADR band | a numbered shelf of decisions | this lane holds the 1500s
```

## How the book gets printed

```lede
One command turns the repo into pages. The checks run afterwards and any failure names what broke.
```

```flow
source: node .claude/scripts/docs/wiki-build.mjs
box: ① Read the tree | one shared reader
box: ② Write the ledger | wiki.json
box: ③ Draw the pages | generated, do not edit
box*: ④ Run the checks | coverage, drift, redraw
labels: found, drawn, then
out: reader fails | stops, names the reader
out: -
out: a check fails | CI red, names the culprit
out+: the wiki | docs/wiki/, committed
divider: 2 | nothing written yet | files now change
note: The ledger is printed on demand and is not committed. Only the pages are.
caption: Figure 1 — one wiki build. | A reader that cannot read stops the run. It never quietly prints an empty book.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Read the repo through one door
plain: The press does not go looking for things itself. It asks the same shared reader the face app asks. So if a new product appears, both see it at once.
d: Discovery is imported from `face-coverage.mjs`, through one added export, and never re-scanned (ADR-1501). No hand-kept inventory exists anywhere (ADR-1502).
f: `.claude/scripts/docs/wiki-build.mjs`

t: Draw a page for everything
plain: Each product, lane, command, rule and so on gets a page. The facts are printed. The plain-words part is pulled in from a separate hand-written file, and if there is none the page shows a visible "not explained yet" banner.
d: Generated output is never hand-edited, and CI regenerates and fails on a difference (ADR-1504). A narrative lives in its own file and its absence is legal (ADR-1505). A new thing is documented at once with a pending banner (ADR-1506).
f: `docs/wiki/`

t: Count in both directions
plain: The headcount fails if something exists with no page, or a page exists with nothing behind it. It was proven first against fake trees with planted mistakes, and the proof itself fails if a planted mistake gets through.
d: Fail-from-birth, with a mutant self-test that must fail closed (ADR-1503). This was the lane's day-3 kill question, and it answered yes.
f: `.claude/scripts/docs/wiki-coverage.mjs`

t: Catch pages that lie or age
plain: If a hand-written page names something that has since gone, the build stops. If the facts merely moved on since it was written, it only warns.
d: Drift blocks, staleness warns (ADR-1507).
f: `.claude/scripts/docs/wiki-drift.mjs` and `.claude/scripts/docs/wiki-stale.mjs`
```

# The bigger loop

## The rule for the plain-words pages

```lede
The printed facts stay honest by being printed. The plain-words pages stay honest by being checked and then read by the owner.
```

The lane first said no model-written explanation may ship (ADR-1508). Later rulings changed that. The
current rule is ADR-1514, still marked proposed: hard facts such as counts and lists live in the
printed sections and are never restated in a narrative. A narrative explains, and every file, command or
decision it names must really exist, which `narrative-anchors` checks. The owner reading the page and
accepting it is the real gate. ADR-1513 is the earlier rule it amends.

## A change, as a story

```loop
top: 1 | something new
top: 5 | the book
stage: 1 · A lane is born | new work starts
stage: 2 · CI goes red | the book is missing a page
stage: 3 · Press is run | wiki-build
stage*: 4 · Page appears | facts printed, pending banner
stage!: 5 · Owner reads | the plain-words part is accepted
labels: names, regenerated, drawn, reads
back: last -> 1 | the next thing born starts the same loop
caption: Figure 2 — how a new thing joins the book. | The banner stays until a person writes and accepts the plain-words part.
```

1. Someone starts a new lane. It has no page yet.
2. The headcount notices and CI turns red, naming the lane.
3. The author runs `node .claude/scripts/docs/wiki-build.mjs` in the same pull request.
4. A page appears with real facts and a "not explained yet" banner.
5. Later, a plain-words page is written, and the owner reads and accepts it.

*This story is an illustration of how the loop runs. It is not a record of one real event.*

## Where it stands

The tracker (`initiatives/docs/PROGRESS.md`) shows the status and cycle in the generated sections. In
words: every phase in the plan is closed, the cycle is closed, and the wiki is live on `main`, held by CI
in both directions. The day-3 kill question passed, and the four overlapping documents were folded away
inside the same cycle.

What is next: nothing inside this lane. The tracker's standing rule is that any lane adding a product,
lane, process, ADR, command, agent, rule or gate runs the build command in the same pull request. Plain-words
pages for the remaining things are written by hand when someone has the reason to.

One gap is written down and still open. Each gate was meant to be attacked by two fresh agents, one on
logic and one on the shell boundary. The boundary attacks ran and found many real holes. The logic
attack never ran in any phase, because the free trial model it was pointed at kept failing on transport
(`initiatives/docs/debt-ledger.md`).

Two lessons the tracker records. One scanner lost track of a regex and printed "clean" while never
reading the renderer, so CI caught it, not the attackers. And lane pages carry only status and cycle,
because more fields would have forced a wiki rebuild on every lane's own progress edit.

## How it connects to the rest of arc

- **The face lane.** The wiki and the face read the tree through the same function. The rule for plain-words pages, ADR-1513, was decided through a face-lane change, not a new docs cycle.
- **Every other lane.** Adding anything to arc now means running the wiki build, or CI turns red.
# Meta

## Glossary

```gloss
lane: one workstream of arc's build, with its own plan, progress file and phases.
cycle: one run of a lane from kickoff to close.
phase: one slice of a cycle, closed only through `/arc-phase-done`.
appetite: the time budget a cycle sets itself. Going past it means cut scope or stop.
fixture: a small fake tree used to prove a check works before real pages exist.
mutant: a deliberately planted mistake that a check must catch, to prove the check works.
attack round: one pass by a fresh agent trying to break a check before it ships.
```
