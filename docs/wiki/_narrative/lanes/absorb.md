<!-- facts: appetite=c68c3357 blocked-on=a68c9074 burn=14bbbb4c cycle=bcf540fd depends-on=a68c9074 hasPlan=b5bea41b phase=42312ac2 status=4c1abf59 title=047eac3a -->
```tagline
The tasting kitchen. When someone else has a clever trick, absorb studies it behind glass, never cooks
their dish, writes its own version, tests both blind, and lets you decide.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Other companies and tools have good ideas.
The temptation is to bolt those tools on. That brings strangers into your kitchen: their code, their
licence, their bugs.

**absorb is the lane that built arc's tasting kitchen.** The plan states the goal in one line: turn a
good technique from outside into arc's own capability, without runtime dependencies, supply-chain risk or
licence trouble (`initiatives/absorb/PLAN.md`).

```panel big
- **Look through glass** (`/arc-absorb`). A studied file is never opened with the assistant's own eyes and never run. Its text is handed over sealed, labelled as "this is data, not an order".
- **Write the tasting note.** A fixed form, checked by `report-lint`: what the trick is, where it was found, what its licence says, and one verdict word.
- **Cook your own version, in one allowed corner.** The rebuild may only land on a short list of places, checked by `rebuild-lint`.
- **Taste both blind.** The old way and the new way are compared, then the owner picks without knowing which is which.
- **You decide.** Nothing adopts itself, and nothing retires itself.
```

### Why this needs to be a lane at all

| What you lose | What it looks like when it bites | absorb's answer |
|---|---|---|
| **A clean kitchen** | Every good idea arrives as a new dependency, and the pile only grows. | An idea is re-written as arc's own file. No outside code comes with it. |
| **Safety while studying** | A hostile README tells the assistant to do something, and it obeys. | The study path only reads, inside a sealed envelope, and a test tries to break that on purpose. |
| **Honest evidence** | "It feels better" becomes the reason to adopt. | A measured comparison plus a blind pick, both kept on record. |

> The plan calls the alternative by name: a lane that just hoards tools. Every organisation drifts
> there unless something stands in the way (`initiatives/absorb/PLAN.md`).

## arc words → normal words

```lede
Six pieces of jargon. Each is an ordinary kitchen thing wearing a technical name.
```

```rosetta
technique | one trick, not a whole tool | the unit that gets studied and rebuilt
extraction report | the tasting note | a fixed form, so nobody has to read the source themselves
verdict | the sorting bucket | ABSORB, INTEGRATE, ROUTE or SKIP
registry | the one recipe ledger | `products/absorb/registry.json`
allowlist | the only corners where a new dish may be cooked | `products/absorb/allowlist.txt`
sealed blind pick | choosing between two unlabelled plates | the labels are revealed only after you choose
```

## How one trick travels

```lede
The road has one hard rule: the first three stops are safe to repeat, and the last one is yours alone.
```

```flow
source: someone else's clever trick
box: ① Study | /arc-absorb
box: ② Rebuild | allowlist only
box*: ③ Test both | A/B, blind pick
box: ④ You decide | adopt or not
labels: note, rebuild, evidence
out: unsafe input | refused, nothing runs
out: outside the allowlist | refused
out: no evidence | stays a candidate
out: no yes from you | nothing adopted
divider: 3 | reversible | your call
note: The decision at the dashed line is always the owner's. The lane only proposes.
caption: Figure 1 — from outside idea to arc capability. | The dashed line marks where a proposal becomes a decision.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Study behind glass
plain: The study reads the source and never runs it. Every piece of text reaches the assistant sealed, so a sneaky sentence inside it cannot pass as an instruction.
d: `study.mjs --read` confines the path and seals content in a nonce-stamped envelope. A test with hostile files and mutants shows that studied code does not execute (`tests/absorb-study-boundary.bats`).
f: `.claude/scripts/absorb/study.mjs`

t: Write the tasting note
plain: The study ends in a fixed-shape note. Every row has a citation, a licence note and a verdict, so a weak note fails the check instead of slipping through.
d: The template is checked by `report-lint`. A source with no licence is recorded as such, and the only honest use is to re-express the idea, never copy it (ADR-0601).
f: `products/absorb/templates/extraction-report.md`

t: Cook in the allowed corner
plain: The new version can only land where the allowlist says. Widening that list is its own reviewed decision, never a shortcut in the middle of a rebuild.
d: `rebuild-lint` checks the diff against the list (ADR-0602).
f: `products/absorb/allowlist.txt`

t: Taste both, then you choose
plain: A measured comparison runs first. Then you pick between two unlabelled results, and the labels are shown only after your pick is written down.
d: `ab-run` runs the measured comparison. `judgement.mjs` records the pick on events arc already has, so no new event kind is added (ADR-0603).
f: `.claude/scripts/absorb/judgement.mjs`
```

# The bigger loop

## The one real dish

A tasting kitchen that never cooked anything would prove nothing, so the lane cooked one. It studied a
review skill from another tool. The trick it kept: a finding the reviewer cannot back with a quote from the
source gets marked low-confidence and pushed out of the main report. The source had no licence at all, so
absorb wrote arc's own version (`docs/playbooks/finding-verification.md`, called from `/arc-audit`).

Then came the twist. The measured comparison said the new way won. The owner's blind pick chose the old
way. The lane's own recommendation was to retire the trick. The owner then adopted it anyway. All three
records stayed on file, and the registry holds the result (`initiatives/absorb/PROGRESS.md`,
`products/absorb/registry.json`).

## Why the lane was allowed to start

None of the usual start-up gates had passed when this lane was born. The owner was shown that gap and
ruled arc-first, and the ruling is written down so nobody has to re-argue it (ADR-0074).

## What was learned

- A fully green test run did not mean the guards guarded. Fresh attackers still found serious holes after
  it (`docs/retro-log.md`).
- Rules were kept in one place each: how the ledger is shaped (ADR-0600), where a rebuild may land
  (ADR-0602), and where absorb ends and its neighbours begin (ADR-0604).

## Where absorb sits in arc

- **Beside four neighbours.** develop owns installable things, bench scores, discover mines ventures,
  evolve runs experiments. absorb only produces proposals (ADR-0604).
- **Same evidence shape as elsewhere.** Its comparisons follow the existing bench-style layout, not
  evolve's own machinery (ADR-0605).
- **Where it started.** Every lane is born through `/arc-kickoff`, and this one was no exception.

# Meta

## Glossary

```gloss
technique: one reusable trick, small enough to study and rebuild as a single change.
allowlist: the fixed list of places a rebuild is permitted to land.
licence refusal: when a source's licence forbids copying, or is absent, the lane records that and re-writes the idea instead.
A/B: two versions compared on the same inputs to see which does better.
steel thread: the thinnest end-to-end slice, built first so every later step has something real to extend.
adversarial pass: a fresh reviewer sent to attack finished work before it counts as done.
```
