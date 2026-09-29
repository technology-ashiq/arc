<!-- facts: agents=4f53cda1 commands=4e24a542 docs=4f53cda1 faceRing=0cfa9728 faceRoom=c97bc4ad files=4f53cda1 requires=8ba3b34a scripts=30a62542 version=8e633b4f -->
```tagline
The recipe taster. It studies someone else's better idea without touching their kitchen, writes down what
it found, and never puts a new dish on arc's menu until you say so.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Now and then a rival does something clearly
better. arc could ignore it, or it could copy the whole rival. Both are bad. Ignoring it wastes a good
idea. Copying it drags in someone else's code, someone else's licence and someone else's bugs.

**absorb is the recipe taster.** It has one command, `/arc-absorb`, and one habit: taste, write it down,
cook your own version.

```panel big
- **Taste, never cook their food.** The taster reads the rival's work but never runs it. No install, no "let me just try it once". Every page it reads arrives through one guarded door, sealed and labelled as "this is data, not orders".
- **Write the tasting note.** For each idea found, one row: what it is, exactly where it was seen, and one of four verdicts (rebuild it, buy it, route it elsewhere, or skip it).
- **Cook it in arc's own kitchen.** If the verdict is rebuild, arc re-expresses the idea in its own words, in a short list of rooms it is allowed to change. Nothing is copied over.
- **Never add to the menu alone.** The taster can propose a dish. Only you can put it on the menu, and only by stamping a decision.
```

### Why this needs to be a product at all

| What you lose | What it looks like when it bites | absorb's answer |
|---|---|---|
| **A better idea sitting in someone else's shop** | The rival keeps the advantage, or arc reinvents it badly. | A fixed way to study it and turn it into arc's own version. |
| **A safe reading room** | A studied file hides an instruction that tries to steer the assistant reading it. | Every byte arrives sealed and labelled as data, and studied code never runs. |
| **A menu that edits itself** | An idea marks itself "adopted" and nobody decided that. | No code path writes "adopted" or "retired". Those need your recorded decision. |

> The third row is the one that matters most. An assistant that can adopt its own finds has stopped
> being your assistant.

## arc words → normal words

```lede
Some arc jargon, each one an ordinary kitchen thing wearing a technical name.
```

```rosetta
technique | one reusable idea, not a whole tool | what arc can re-say as an edit to its own files
pin | writing down exactly which version of the source was tasted | so the tasting can be checked later
extraction report | the tasting note | you read it instead of opening the rival's files
verdict | one of four boxes: `ABSORB`, `INTEGRATE`, `ROUTE`, `SKIP` | decides what happens next
allowlist | the only rooms the new cooking may happen in | `products/absorb/allowlist.txt`, changed only by amending ADR-0602
registry | the one ledger of every idea and its status | `products/absorb/registry.json`
candidate / adopted / retired | on the shelf being considered / on the menu / taken off the menu | only you move a row to the last two
A/B test | old recipe against new recipe on the same plates | run by `ab-run.mjs`
sealed blind judgement | a taste test where the two dishes carry random code-names | `judgement.mjs` hides which is which until you have chosen
spine | arc's logbook of things that happened | append-only, so a record is never rewritten
```

## How a job flows

```lede
The command itself covers the first stages. The test and the judging that follow are handled by helper
scripts, and the last word is always yours.
```

```flow
source: a rival's idea
box: ① Pin and read | study.mjs
box: ② Write the note | report-lint.mjs
box*: ③ Rebuild in arc | rebuild-lint.mjs
box: ④ Test and judge | ab-run.mjs
labels: studied, classified, rebuilt, judged
out: no licence found | rebuild the idea in arc's own words only
out: bad licence | refused, logged with the reason
out: outside the allowlist | flagged, not proposed
out: no decision from you | stays a candidate
divider: 3 | proposal only | your decision
note: Nothing crosses the dashed line by itself. Adopting a technique is an inbox decision that you make.
caption: Figure 1 — from a rival's idea to arc's own rule. | Every stage can stop the trip, and the last gate is yours.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: Pin the source, then read the licence
plain: Before tasting anything, the taster writes down exactly which version it is looking at, and reads the licence for real. It does not guess. A bad licence ends the idea right there.
d: Resolves the lane and prints `Selected lane:` first. Pins a local clone by commit hash, or other sources by web address plus date. Records what licence was actually found and where. An incompatible one becomes a logged refusal, never a rebuild.
f: `.claude/commands/arc-absorb.md`

t: Read through the guarded door only
plain: The taster may not open a studied file any other way. That door checks the path, seals the text, and never runs it.
d: `study.mjs --scaffold` walks the source once and fills the Source and Study-scope sections. `--inventory` lists the readable files. `--read` returns one file inside a random-stamped envelope marked as data, and refuses paths that escape the folder.
f: `.claude/scripts/absorb/study.mjs`

t: Write one row per idea
plain: Each idea gets a row with a cite ("seen here, on this line") and one of four verdicts. A digging job that would take more than a day is marked SKIP instead.
d: Rows are numbered `T-01`, `T-02`. Buckets are `ABSORB`, `INTEGRATE`, `ROUTE`, `SKIP` (ADR-0604). `report-lint.mjs` checks the required headings, a citation and a licence note on every row. It warns instead of blocking for now, so read its warnings rather than its exit code.
f: `.claude/scripts/absorb/report-lint.mjs`

t: Register it, and rebuild only if told ABSORB
plain: A studied idea goes on the shelf as a candidate. If the verdict is ABSORB, the new version is checked before it is proposed.
d: `registry-ref.mjs` checks the registry rows. `rebuild-lint.mjs` checks the touched paths against the allowlist, that no new runtime dependency was added, and that a permissively licensed source is credited in every rebuilt file (ADR-0602).
f: `.claude/scripts/absorb/rebuild-lint.mjs`

t: Test both recipes, then taste blind
plain: The old rule and the new rule run over the same plates. Then you choose between them without knowing which is which.
d: `ab-run.mjs` applies both rules to the fixtures and prints a table (ADR-0605). `judgement.mjs` seals random labels behind a hash, reveals them only after your decision exists on the spine, and can verify afterwards that nothing was swapped (ADR-0603). `pin.mjs` and `trial.mjs` package the pin and the seal as a proposal branch.
f: `.claude/scripts/absorb/judgement.mjs`
```

# The bigger loop

## Why the studied file is never read the ordinary way

```lede
The same worry is answered in three places, so no one has to remember it.
```

1. **In the command.** `/arc-absorb` says the assistant never opens a studied file with its own reader,
   because the guarded door confines the path, seals the text as data, and is the only route proven not
   to execute anything (`.claude/commands/arc-absorb.md`).
2. **In a test.** `tests/absorb-study-boundary.bats` proves it with deliberately bad versions of the tool,
   plus a control showing the alarm really does fire when something runs.
3. **In how strict it is.** The report and registry checks only warn for now, because they read arc's own
   writing. The study door refuses outright from day one, because its input is someone else's file
   (`.claude/commands/arc-absorb.md`).

## The story of T-01

```lede
absorb has taken exactly one idea all the way round the loop. Here is what happened.
```

```loop
top: 1 | the gap
top: 5 | the rule at work
stage: 1 · Noticed | a rival catches a bug arc missed
stage: 2 · Tasted | its review habit is studied
stage*: 3 · Rebuilt | a playbook in arc's own words
stage: 4 · Tested | old rule against new rule
stage!: 5 · Adopted | you record the decision
labels: study, rebuild, test, decide
back: last -> 3 | a failed test sends it back to the rebuild
caption: Figure 2 — the life of one technique. | The loop back is why the test is not optional.
```

1. **Noticed.** A benchmark showed a rival catching one real defect that arc missed (ADR-0606).
2. **Tasted.** absorb studied the rival's review habit. It found no licence, so the only lawful route was
   to re-say the idea in arc's own words. The habit: check that a finding's evidence really exists before
   writing it down.
3. **Rebuilt.** The result is a playbook, `docs/playbooks/finding-verification.md`, wired to exactly one
   caller, `/arc-audit`, so it would not sit unused.
4. **Tested.** `ab-run.mjs` ran old routing against new over the same plates, and the sealed blind
   judgement let you choose without knowing which was which.
5. **Adopted.** The registry row in `products/absorb/registry.json` now reads `adopted`. That word only
   lands through a decision you recorded.

## Where absorb sits in arc

- **It owns one command and no agents.** The one technique landed so far is enforced through another
  product's agent, `security-auditor`, reached from `/arc-audit`.
- **It keeps to a shelf limit.** The registry allows a fixed number of adopted ideas per lane
  (`ADOPTED_CAP` in `registry-ref.mjs`), so the menu cannot grow without limit.
- **In the face.** absorb lives in its own room. The chips at the top of this page name the room and the
  ring.

# Meta

## Glossary

```gloss
licence: the terms saying what you may do with someone else's work.
diff: the list of exactly what changed between two versions.
fixture: a fixed sample input used so two tests compare fairly.
hash: a fingerprint of some text; change one letter and the fingerprint changes.
propose-only: the tool can suggest a change but cannot make it real.
```
