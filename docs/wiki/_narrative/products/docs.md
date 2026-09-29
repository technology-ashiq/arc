<!-- facts: agents=4f53cda1 commands=4f53cda1 docs=4f53cda1 faceRing=785b1405 faceRoom=1fa51fec files=4f53cda1 requires=1f70e0bb scripts=89b39d16 version=8e633b4f -->
```tagline
The librarian who never trusts an old catalogue. Every time the wiki is built, docs walks the whole
building again, rewrites the catalogue from what is really on the shelves, and refuses to let a page
name something that is gone.
```

# Start here

## In plain words

Think of arc as a big library that keeps growing: products, lanes, commands, agents, rules, gates.
Somebody has to keep a catalogue of it, so a newcomer can find things.

The usual way to do that is to type the catalogue by hand. It is right on the day it is typed.
Then a shelf moves, a book is thrown out, and the catalogue keeps quietly claiming the old truth.

```panel big
**docs is the librarian who re-counts the shelves every time.** It has two jobs:

- **Write the catalogue from the shelves.** Every list, name and number on a reference page is worked out from the real files, not typed by a person. Nobody can forget to update it, because nobody updates it.
- **Guard the hand-written notes.** People do write the "why" for a page in their own words. docs never rewrites those notes. It only checks that they do not point at a book that is no longer there.

That is the whole product. The rest of this page is how the librarian does those two jobs.
```

### Why this needs to be a product at all

A catalogue nobody re-counts is a catalogue that starts lying. arc had four different files, each
trying to be the one true account of the system, and they slowly disagreed with the tree (ADR-1510).
The fix was not a better file. It was to stop typing the facts at all (ADR-1502).

The librarian is its own product, and not part of the floor every product stands on, because that
keeps the floor small. docs reads the floor, and the floor never reads docs (ADR-1512).

## arc words → normal words

```lede
Nine pieces of arc jargon. Each one is an ordinary library thing wearing a technical name.
```

```rosetta
wiki | the catalogue | one generated page per part of arc, in `docs/wiki`
narrative | a handwritten note | the "why" for a page, in its own file, never generated
generated section | the part of a page the librarian writes | lists, names, counts; nobody edits it
`wiki-build` | re-walk the building and reprint | rebuilds every generated page from the tree
`wiki-coverage` | the shelf-and-card check | every part has a page, and every page has a part
drift | a note pointing at a removed book | a narrative naming an ADR, command or path that is gone
`wiki-stale` | "the shelf changed since you wrote this" | a warning, never a block
explanation debt | books with no note yet | a count of parts no narrative explains, never a target
owner acceptance | you signed the note as read | recorded against the note's exact text
```

## How a page gets made

```lede
The facts come from the shelves. The words come from a person. The two are kept apart on purpose.
```

```flow
source: wiki-build
box: ① Walk the building | read the tree
box: ② Reprint pages | one per part
box: ③ Add the notes | hand-written, as is
box*: ④ Check the result | coverage · drift · stale
labels: facts, pages, notes
out: no note yet | page says so, still shows facts
out: note names a gone thing | drift blocks it
out: facts moved since the note | stale warns
out+: catalogue | agrees with the tree
divider: 1 | facts, generated | words, by a person
note: A person never edits the printed pages. Change the tree, then reprint.
caption: Figure 1 — one build of the catalogue. | The dashed line is where machine-made facts end and human-written words begin.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: Walk the building
plain: The librarian does not remember the shelves from last time. It walks them fresh, using the one map arc already has of itself, so the catalogue and the app's own room list can never disagree about what exists.
d: `wiki-build` never lists a directory itself. It reads what the shared inventory reports and opens one named file per part: a product manifest, a lane tracker header, a process file, an ADR, a command or agent or rule header, a gate row. A file it cannot read stops the build and is named; it is never quietly treated as empty (ADR-1501).
f: `.claude/scripts/docs/wiki-build.mjs`

t: Reprint the pages
plain: One page per part, same wording every time you run it, every page stamped "do not edit by hand". If someone edits a printed page anyway, the next check catches it.
d: The output is deterministic: sorted lists, no clock, no machine paths. `wiki-build --check` compares a fresh print with what is committed and goes red on any difference (ADR-1504).
f: `.claude/scripts/docs/wiki-build.mjs`

t: Check the shelves against the cards
plain: A page for something that no longer exists is a lie with authority. A real part with no page is invisible. So the check runs in both directions, and it has never been allowed to just warn.
d: `wiki-coverage` fails, by name, on a part with no page and on a page or note that belongs to nothing. It also carries a self-test that plants broken trees and proves each one is caught (ADR-1503).
f: `.claude/scripts/docs/wiki-coverage.mjs`

t: Guard the handwritten notes
plain: Notes are the human part, so they are never rewritten. Two checks read them. One blocks a note that names something gone. The other only warns when the facts moved after the note was written, so the writer knows what to re-read.
d: `wiki-drift` blocks any narrative naming an ADR, command or file path that does not exist (ADR-1507). `wiki-stale` compares the fingerprint on a narrative's first line with today's facts and warns, exit 0, naming the fact that moved.
f: `.claude/scripts/docs/wiki-drift.mjs` · `.claude/scripts/docs/wiki-stale.mjs`

t: Count what is unexplained, and record that you read it
plain: The librarian keeps a tally of parts nobody has explained yet. And a note only counts as finished when you, the owner, have read it and said so.
d: `narrative-anchors` runs the same "does it exist" check on names in a note, counts the explanation debt, and with `--accept` stores your acceptance against the note's exact text. Edit the note afterwards and it shows as awaiting you again (ADR-1514).
f: `.claude/scripts/docs/narrative-anchors.mjs`
```

# The bigger loop

## A part appears, and the catalogue catches up

```lede
Adding something to arc is enough. Nobody has to remember to add it to the catalogue.
```

```loop
top: 1 | a new part
top: 4 | the catalogue
stage: 1 · Built | a new command lands in the tree
stage: 2 · Reprinted | its page appears, facts only
stage*: 3 · Explained | a person writes the why
stage: 4 · Read | the owner accepts it
stage!: 5 · Later | the command is renamed
labels: build, write, read, time
back: last -> 3 | drift blocks the note until it is fixed
caption: Figure 2 — life of one entry. | The loop back is why a renamed thing cannot leave a stale explanation behind.
```

1. Someone adds a command to arc.
2. The next `wiki-build` prints a page for it with every fact the tree declares, and a banner saying the note is still pending. Nothing is hidden and nothing is invented.
3. A person writes the why in a separate note file. The debt count drops by one.
4. You read it in the reference room, and accept it.
5. Months later the command is renamed. The note still names the old one, so `wiki-drift` goes red and the note has to be fixed before anything ships.

*The command in this story is an illustration of how the loop runs, not a real incident.*

```panel warn
title: what docs will not do
It will not write the explanation for you, and it does not judge whether a note is good. The checks prove a note points at real things. Whether it is understandable is your read (ADR-1514), which is why acceptance is a step of its own.
```

## Where docs sits in arc

- **On top of the floor.** docs requires the three products listed in the facts above, and reads the same inventory the app's completeness check reads, so the two cannot describe different arcs.
- **In the face.** docs lives in the lane room of the factory ring. The Reference room shows the same generated facts and the same notes inside the running app (ADR-1348).
- **Past its own edges.** A drafted narrative used to need a per-sentence verifier before shipping. That was loosened: facts moved into generated sections, and the owner's read became the gate (ADR-1514, amending ADR-1513).

# Meta

## Glossary

```gloss
ADR: a short written decision record. Each one is numbered so a note can point at it.
deterministic: same input, same output, byte for byte. That is what lets a check compare a fresh print with the committed one.
fingerprint: a short code on a note's first line, saying which version of the facts it was written against.
frontmatter: the small block of settings at the top of a command, agent or rule file.
narrative pending: the banner a page shows when nobody has written its note yet. The facts are still there.
```
