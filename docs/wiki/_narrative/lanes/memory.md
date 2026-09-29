<!-- facts: appetite=cefdf849 blocked-on=a68c9074 burn=f72cb1a4 cycle=a1a957d1 depends-on=a68c9074 hasPlan=b5bea41b phase=43817889 status=4c1abf59 title=08c5f829 -->
```tagline
The company librarian. Ask it a question in plain words and it hands back the lessons arc has already
paid for, word for word, with the file each one came from.
```

# Start here

## In plain words

Think of arc as a company that has written down every hard lesson it ever learned: a mistake, a ruling,
a rule. The notes are all there. But they sit in different filing cabinets, and nobody has time to
open every drawer. So the same mistake gets paid for twice.

**The memory lane builds the librarian.** You ask it a question, for example "how did we get burned by
this before". It searches the cabinets and hands back the matching notes, copied exactly as written,
each with the address of the file it came from.

```panel big
**The librarian only reads.** It never edits the cabinets, never files a new note, and never writes to arc's logbook (ADR-0703). It also never rephrases a lesson. What you get is what was written, plus where to find it (ADR-0702).
```

### What this lane is for

The lane's goal, from its plan (`initiatives/memory/PLAN.md`), is that a lesson arc has already paid for
is never learned again just because nobody could find it. Two of arc's own routines are handed the
librarian's answer without anyone asking: the one that plans a build and the one that reviews a change.

### The road it chose first

The first design said the search should sit on a database feature built into newer versions of Node,
arc's runtime. The kickoff tested that and found most of arc's test machines cannot use it. So the
owner chose a plain search that works everywhere, with the database as an optional speed-up (ADR-0701).
Later the lane measured how long the search really takes, found it was already fast enough, and never
built the speed-up.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary library thing wearing a technical name.
```

```rosetta
arc-recall | the librarian's desk | takes a question, returns ranked notes with a citation on each
organ | one filing cabinet | retro log, trial ledger, learning ledger, decision records, the logbook
adapter | the clerk for one cabinet | reads that cabinet and turns each note into a searchable card
index | the card catalogue | rebuilt from the cabinets; deleting it loses nothing
count-verify | "every card accounted for" | nothing is skipped without a written reason naming file and line
golden query | a test question with a known right answer | written down before tuning, so the grader cannot move the goalposts
root-mode | works with no lane at all | the lane name is only a label on a note, never a requirement
alias layer | a synonym list for the search | a hand-kept table of words that mean the same thing
```

## How one question goes

```lede
The librarian searches by words, ranks by match, and always shows its sources. When it cannot find
anything it says so instead of guessing.
```

```flow
source: arc-recall "<your question>"
box: ① Card catalogue | built from every cabinet
box: ② Widen the words | the synonym list
box: ③ Rank the cards | best word match first
box*: ④ Hand back the notes | verbatim + address
labels: cards, terms, matches
out: -
out: -
out: -
out+: notes | each with a repo path
note: The librarian reads the cabinets. Nothing is written back to them.
caption: Figure 1 — one recall. | No step rewrites a lesson, and no step calls an AI model.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Build the card catalogue
plain: One clerk per cabinet reads every note and makes a card for it. The catalogue is checked so that every note became a card, and any note left out is named with its file and line. It is rebuilt whole each time, never patched.
d: The cabinets are the retro log, the trial ledger, the learning ledger, the ADR folder and the logbook's decision events. The index is derived from them and can be deleted and rebuilt (ADR-0700).
f: `.claude/scripts/memory/memory-index.mjs`

t: Ask the question
plain: You type a question in ordinary words. The librarian widens it with its synonym list, then ranks the cards by how well they match.
d: A plain search with no AI model and no embeddings (ADR-0709). The synonym list is small and reviewed by hand.
f: `.claude/scripts/memory/arc-recall.mjs`

t: Get the notes back, verbatim
plain: The answer is the original wording of each matching note, with the file it lives in. Nothing is summarised. Lessons about how to prevent a repeat come first.
d: Every row carries a citation with a repo path, and a bare number is never printed alone (ADR-0702). A `--decisions` option asks only about past decisions.
f: `docs/retro-log.md` is one of the cabinets it reads

t: Check for a clash before a new rule is filed
plain: When `/arc-retro` is about to add a rule, it first shows any existing rule that looks nearly the same. A person decides whether they clash. Nothing is merged or blocked automatically.
d: A wording-overlap check only. It does not understand meaning, and says so (ADR-0705).
f: `.claude/scripts/memory/conflict-check.mjs`
```

# The bigger loop

## Grading the librarian

```lede
The search is graded on a fixed set of questions, written before anyone tuned anything. The grade
cannot be moved to make the search look good.
```

A "golden query" is a question with a known right answer. The set was committed before any clerk was
built, so nobody could tune the search to the exam. The build only passes if the right note comes back
near the top for every one of them (ADR-0706). How often people actually use a recalled note is watched,
but it is never allowed to fail the build.

## A recall, as a story

```loop
top: 1 | a new plan
top: 5 | the next build
stage: 1 · Plan drafted | goal: change how routing works
stage: 2 · Librarian asked | by the planner, unprompted
stage: 3 · Old notes return | "we tried this, it broke"
stage*: 4 · The plan changes | it avoids the old trap
stage!: 5 · Lesson filed | with a clash check first
labels: question, notes, plan, lesson
back: last -> 1 | the new note is there for the next plan
caption: Figure 2 — how a lesson keeps paying off. | The loop closes when a new lesson goes back into a cabinet.
```

1. A build is being planned and its goal is typed in.
2. The plan-drafting routine asks the librarian about that goal, automatically (ADR-0704).
3. Two old notes come back, word for word, with their files.
4. The plan takes a different route around the old trap.
5. Later, `/arc-retro` files a new lesson, after showing any near-duplicate for a person to judge.

*This story is an illustration of how the loop runs. It is not a real recall.*

## Where it stands

The tracker (`initiatives/memory/PROGRESS.md`) holds the live status in the generated sections. In words:
all three phases are closed, the librarian is merged, and the lane is idle. The second speed-up engine
was cut on its own measurement, while the test that would prove two engines agree still ships.

What is still open is written in `initiatives/memory/debt-ledger.md`. The check that grades the
librarian runs inside the normal test run rather than as its own named CI job, because the workflow
folder is deliberately locked against edits. The synonym list ships empty, since nothing measurable
improved when it was filled. And everything was proved on arc's own notes only: the librarian has not yet
run in another company's repo.

## How memory sits in arc

- **Planning.** The routine behind `/arc-kickoff` asks the librarian about the goal
  (`processes/kickoff-plan.process.yaml`).
- **Reviewing.** The routine behind `/arc-review` asks it about the change
  (`processes/review-diff.process.yaml`). Landing this meant retiring another lane's proof that a
  generated command never changes, which ADR-0207 records.
- **Retros.** `/arc-retro` runs the clash check before it adds a rule.

# Meta

## Glossary

```gloss
bm25: a standard way of ranking search results by how well the words match. It is not an AI model.
verbatim: copied exactly as written, with no rewording.
citation: the file path a note came from, so you can go and read the original.
spine: arc's append-only logbook of what happened. The librarian reads it and never writes to it.
adversarial pass: a fresh agent, who did not write the code, tries to break it with hostile input.
```
