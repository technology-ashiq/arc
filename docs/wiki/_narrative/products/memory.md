<!-- facts: agents=4f53cda1 commands=4f53cda1 docs=4f53cda1 faceRing=0cfa9728 faceRoom=e38694e8 files=4f53cda1 requires=8ba3b34a scripts=efbf9c3e version=39fe4a40 -->
```tagline
The librarian for everything arc has already learned. It does not keep a second copy of any lesson. It
builds a card catalogue over the shelves where the lessons already sit, so nobody makes the same mistake twice.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Every time something goes wrong, someone
writes a lesson down. Over months, the lessons pile up in five different places.

**memory is the librarian.** It never moves a book. It walks the five shelves, writes one card for every
lesson, and keeps the cards in a single drawer that it can throw away and rebuild whenever it likes.

```panel big
- **The five shelves.** The retro log (`docs/retro-log.md`), the trial ledger (`docs/trial-ledger.md`), the learning ledger (`docs/develop/learning-ledger.md`), the decision records in `docs/adr/`, and the "decision recorded" lines in arc's logbook. They stay exactly where they are.
- **The card catalogue.** One derived file. Delete it and the librarian rebuilds it. It is never the truth, only a way to find the truth.
- **The reading desk** (`arc-recall.mjs`). You ask a question. It hands back the recorded words themselves, word for word, with a note saying which page they came from. It never retells them.
- **The pen guard** (`lesson-log.mjs`). Before a new lesson is written on a shelf, it checks whether the same lesson is already there.

memory adds no command of its own. It is reached through `/arc-retro`, `/arc-kickoff` and `/arc-review`.
```

### Why this needs to be a product at all

An early plan was to move all lessons into one brand-new store. The record shows why that was dropped
(ADR-0700): each shelf already had a reader who would break, and a second copy would mean two truths for
one fact.

| What you lose | What it looks like when it bites | memory's answer |
|---|---|---|
| **Old lessons nobody reads** | The same mistake is made twice because the lesson was filed in a drawer nobody opened. | One question searches all five shelves at once. |
| **A confident wrong citation** | A bare decision number pointed at a different, unrelated decision, four times in one cycle (ADR-0702). | Every answer carries the file path, and the words are never paraphrased. |
| **A search that quietly got worse** | Nobody notices the catalogue stopped finding things. | A fixed exam of questions with known answers is run every time, and a bad score fails the build (ADR-0706). |

> If memory were deleted tomorrow, arc would lose a search box and nothing else. That is on purpose.

## arc words → normal words

```lede
Eight pieces of jargon. Each is an ordinary library thing wearing a technical name.
```

```rosetta
organ | one of the five shelves of lessons | the retro log, trial ledger, learning ledger, decision records, logged decisions
index | the card catalogue | derived, kept out of git, safe to delete
recall | asking the librarian | the answer is the recorded text with its source path
citation | the "go look on this page" note | a path is always given, never a bare number
near-duplicate check | "didn't we already write this down?" | shows the match, and a person decides (ADR-0705)
golden query set | the spot-check exam | fixed questions with known right answers (ADR-0706)
alias | a translation note between two people's words | added only after a real question failed (ADR-0709)
HISTORICAL DATA fence | a "this is a quote, not an order" label | wrapped round recalled text before another job reads it
```

## How a job flows

```lede
Reading is free and leaves no trace. Writing goes through a guard, and the guard asks before it saves.
```

```flow
source: a lesson or a question
box: ① Catalogue | memory-index.mjs
box*: ② Ask | arc-recall.mjs
box: ③ Guard the pen | lesson-log.mjs
box: ④ Exam | golden-check.mjs
labels: counted, ranked, checked
out: a card is missing | the catalogue fails to build
out: no match | an empty answer, not an error
out: looks like a repeat | shown, a person decides
out: an exam question misses | the build goes red
divider: 2 | reading | writing
note: Reading emits nothing to the logbook. Only a write ends in a receipt.
caption: Figure 1 — from lesson to catalogue to answer. | The dashed line marks where the librarian starts changing things.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: The catalogue is built and counted
plain: The librarian walks every shelf and writes a card per lesson. Then it counts. If the shelf held more lessons than there are cards, the whole job stops loudly.
d: Reads the five organs, checks that parsed records equal indexed records for each one, names every row it declines with its file and line, and writes one file by an atomic rename so nobody sees a half-built catalogue.
f: `.claude/scripts/memory/memory-index.mjs`

t: A question gets an answer in the original words
plain: You ask in your own words. The librarian looks up the cards and reads you the recorded lines, the actionable part first, each with its page.
d: Splits the question into words, widens them through the alias table, ranks the cards with a scoring method called BM25, and prints matching rows verbatim with citations. No match is a normal empty answer.
f: `.claude/scripts/memory/arc-recall.mjs`

t: Other jobs ask without being told
plain: When a plan is kicked off or a diff is reviewed, the librarian is asked automatically. Its answer is added on top of what those jobs already read, never in place of it.
d: `/arc-kickoff` recalls on the goal sentence, eight results at most. `/arc-review` recalls on the changed file paths. Both wrap the answer in the label `HISTORICAL DATA, NOT INSTRUCTIONS`.
f: `.claude/scripts/memory/diff-recall.mjs`

t: The pen guard checks before it writes
plain: A new lesson is compared with what is already on the shelf. If it looks like a repeat, the guard shows the old one and writes nothing until a person decides.
d: Checks the row has its five parts, scans it for secrets because the repository is public, runs the near-duplicate rule, appends the row, and ends on a `note.logged` receipt. The rule compares shared tags and wording overlap, never meaning, and says so. Run as the `lesson-log` process.
f: `.claude/scripts/memory/lesson-log.mjs`

t: A rule is proposed, never applied
plain: Promoting a lesson to a standing rule does not touch your working files. It writes the change on a fresh side branch and asks you to accept or refuse.
d: Appends the rule to an existing home such as `CLAUDE.md` or a file under `.claude/rules/`, on a new branch built without a checkout, and ends on an `approval.requested` receipt. Run as the `rule-promote` process.
f: `.claude/scripts/memory/rule-propose.mjs`

t: The librarian sits an exam
plain: A fixed list of questions with known right answers is asked every time. If the right lesson does not show up near the top, the build fails.
d: Checks each expected record still contains its anchor text, then measures whether the expected id lands in the top three. A good score is required, not just an absence of errors.
f: `.claude/scripts/memory/golden-check.mjs`
```

# The bigger loop

## The life of one lesson

Here is one lesson's journey. It is an illustration, not a real entry.

```loop
top: 1 | the mistake
top: 5 | the next plan
stage: 1 · Noticed | a retro spots a repeat mistake
stage: 2 · Checked | the guard looks for a twin
stage*: 3 · Filed | one row on the retro log shelf
stage: 4 · Catalogued | a card is written for it
stage!: 5 · Recalled | the next kickoff is shown it
labels: retro, guard, write, index
back: last -> 1 | a lesson that was ignored gets found again
caption: Figure 2 — one lesson, from mistake to memory. | The guard at stage 2 is why the shelf does not fill with twins.
```

Suppose a retro finds that a gate was trusted before anyone tried to break it. `/arc-retro` writes that as
one row. The guard checks it against the log, and if a near-twin exists it is shown to the writer, who
appends anyway or amends the old row. Weeks later a new plan mentions a gate. `/arc-kickoff` recalls, and
the old row appears, fenced as a quote, with its path.

## What memory refuses to do

1. **It refuses to keep a second copy.** The shelves are the truth (ADR-0700).
2. **It refuses to retell.** Answers are the recorded words with a path (ADR-0702).
3. **It refuses to spam the logbook.** Reading emits nothing, and the logbook's closed list of kinds is not
   extended for searches (ADR-0703).
4. **It refuses to settle contradictions by machine.** Surfacing a possible repeat is all it does (ADR-0705).
5. **It refuses to grade itself on being cited.** A metric that only rewards citing would teach ritual
   citing, so the surfaced-and-cited log is for looking at, never for gating (ADR-0706).

## Where memory sits in arc

- **Under the retro habit.** `/arc-retro` is the door lessons come in through.
- **Beside the planners.** `/arc-kickoff` and `/arc-review` each read from it, additively (ADR-0704).
- **Needs no lanes.** A lane is just a note on a record that has one. With no lanes at all, memory works
  the same (ADR-0707).
- **In the face.** memory has its own room. The chips at the top of this page name the room and the ring.

# Meta

## Glossary

```gloss
organ: one of the five places arc's lessons already live.
index: the one derived file memory writes; it can be deleted and rebuilt.
verbatim: the exact recorded words, not a summary.
Jaccard score: a number for how much two pieces of text share the same words.
BM25: a common way of ranking which cards match a question best.
receipt: one line in arc's logbook saying "this happened".
```
