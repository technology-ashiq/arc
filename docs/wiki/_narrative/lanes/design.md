<!-- facts: appetite=3e849023 blocked-on=a68c9074 burn=cefdf849 cycle=6100f57c depends-on=a68c9074 hasPlan=b5bea41b phase=bd5f0091 status=8ddd7aee title=c01c3fed -->
```tagline
The lane that teaches arc to look at its own drawings. Before anyone judges a screen, the person who
made it opens the picture, compares it with real screens worth learning from, and revises.
```

# Start here

## In plain words

Think of arc's design work as a small design studio.

The studio has a studio head, a drafter who draws a screen, a critic and a jury. On paper that sounds
fine. The trouble, found in the first design cycle, was that the judging happened on **reports about
the pictures**. Nobody in the room had opened the picture itself. The owner looked once, at the real
output, and scored it 23 out of 100 (`docs/retro-log.md`).

```panel big
**This lane fixes the studio in three ways.**

- **Eyes.** The drafter (`ui-composer`) renders its own page, looks at the screenshot, and revises, up to three times, before anyone else sees it.
- **Taste.** Every brief gets a folder of real screens to learn from. The critic and the jury measure new work against those screens, not against an adjective like "clean".
- **Rivals.** Outside AI design tools get to submit a draft into the same blind judging round, so that "is our work actually good" becomes something written down.

Nothing is ranked, scored or packaged from a report about a picture that nobody opened. That sentence is the lane's rule number one.
```

### Why it needs its own lane

A lane is one workstream of arc's build. It has its own plan, its own progress file and its own status.
This one is big enough to need all three, because it changes agents that other work depends on.

| What went wrong before | What it looked like | This lane's answer |
|---|---|---|
| **Judging pictures nobody opened** | Five critique rounds and three blind rankings ran, and the owner scored the result 23/100. | The drafter looks at its own screenshot first (ADR-1401). |
| **A pass that only meant "no rule broken"** | Plain, characterless work passed five runs in a row. | A finding class for work that is below the bar, tied to a real reference screen (ADR-1406). |
| **A rule the agent could not obey** | The drafter was told never to read certain files, yet needed exactly those files. | A short, written list of what it may read (ADR-1415). |

## arc words → normal words

```lede
A few pieces of jargon, each one an ordinary studio thing wearing a technical name.
```

```rosetta
lane | one workstream of the build | it has its own plan and progress file
brief | the job sheet for one screen | it carries four promises: how it behaves, how it looks, what device, what content
`ui-composer` | the drafter | draws a page, renders it, looks, revises
`design-critic` | the critic | reads the rendered page and judges it, never fixes it
`design-jury` | the jury | ranks unlabelled candidates against each other on craft
`design-director` | the studio head | gives each variant its own idea so they differ on purpose
reference pack | a folder of real screens to learn from | only the facts about them are saved in git, never the images
BELOW-BAR | "nothing broken, but not good enough" | fails work that a rule-checker would let through
blind jury | judges who do not know whose work is whose | arc drafts, a reference screen and a rival draft, all unlabelled
spike | a small test run of a rival tool | done before any real code depends on it
tripwire | a pre-agreed stop sign | if the numbers say stop, the next phases do not start
DSV | one of the design plan's own locked decisions | DSV-A to DSV-L, each written up as an ADR from 1400 to 1411
```

## How one design run is meant to flow

```lede
When every phase has landed, one run goes through the whole studio in order. Some steps already work.
The rest are still on the plan.
```

```flow
source: a brief for one screen
box: ① Studio head | each variant gets its own idea
box: ② Curator | gathers real reference screens
box: ③ Drafter | draws, looks, revises up to 3 times
box*: ④ Judges | critic and blind jury
labels: idea, pack, drafts
out: no pack | critic has no bar
out: rule broken | back to the drafter
out: below the bar | back to the drafter
out+: a ranked result | with the owner's blind score
caption: Figure 1 — one design run, once the lane is finished. | The curator is planned in Phase 02 and is not built yet; the drafter's look-and-revise step is already in.
```

## Where the work stands, phase by phase

```lede
Nine phases, built one after another, from the safest piece to the riskiest. Each is closed only with proof.
```

```steps
t: Phases 00 and 01, closed
plain: First the renderer was made safe, so two pictures of one screen never overwrite each other. Then the drafter got its eyes: it renders its own work, looks, and revises, and a gate refuses a pass if a screen the brief promised was never rendered.
d: Phase 01 took far longer than planned. Two independent attack rounds found real holes, for example that the drafter's allowed command list actually opened up everything, and that one draft could pull in a sibling draft's pictures. Both were closed (ADR-1415, ADR-1418).
f: `initiatives/design/PROGRESS.md` · Done-log

t: Phase 02, open now
plain: A short list of galleries the owner approved, a check of each gallery's own rules before anything is fetched, and a builder that assembles the reference pack. The list and the builder are in. The real pack from two permitted galleries is not built yet.
d: The gallery rules check and pack builder went through two attack rounds and were merged. The plan also calls for a curator agent, but no curator agent file exists in the repo yet.
f: `initiatives/design/phases/phase-02-spec.md`

t: Phases 03 and 04, next
plain: The jury is reworked to rank any number of drafts, and the owner gives his first controlled blind score. Then a paired experiment settles, with evidence, whether the drafter needs a stronger model.
d: Phase 03 carries the taste tripwire. If the owner's score does not beat a freshly measured plain-prompt score, Phases 05 to 07 do not start.
f: `initiatives/design/phases/phase-03-spec.md`

t: Phases 05 to 08, later
plain: Live sources for the reference pack, a small proof of one rival tool, putting a rival draft into the blind jury, and finally a packager that refuses to send out anything not made by arc.
d: A rival tool is not called at all until its terms of use have been recorded (ADR-1413).
f: `initiatives/design/phases/phase-08-spec.md`
```

The lane's own numbers, the ten requirements, the day budget and the twenty decisions are kept in the
generated sections of this page, so they are not repeated here.

# The bigger loop

## A story of one draft

```lede
One made-up draft, to show what "the drafter looks at its own work" changes. This is an illustration, not a real run.
```

```loop
top: 1 | the drafter
top: 4 | the critic
stage: 1 · Draw | a pricing page
stage: 2 · Look | opens its own screenshot
stage*: 3 · Revise | the cards are cramped, fix
stage: 4 · Judge | measured against real screens
labels: render, notice, submit
back: last -> 2 | below the bar, look again
caption: Figure 2 — the look-and-revise loop. | The loop is capped at three turns, and every turn leaves a saved record.
```

1. The drafter builds a pricing page for a brief.
2. It renders the page and opens the screenshot. Before this lane, this step did not exist.
3. It notices the price cards are cramped on a phone, and fixes them. Each turn leaves a record of what it
   started from and what it produced.
4. The critic then judges the finished page. If it is plain but nothing is broken, the critic can now say
   it is below the bar, and cite the reference screen it compared against.

*The pricing page is an illustration of how the loop runs, not a real incident.*

## The two stop signs

```lede
The plan does not just hope. It writes down, in advance, when to stop.
```

```panel warn
title: stop sign 1, already reached
If Phases 00 and 01 were not both done by the end of day three, the plan said to stop and rethink the renderer. That day passed with Phase 01 still open. The owner ruled on 2026-09-16 to continue all nine phases, because the overrun came from the two attack rounds, not from the renderer the sign exists to protect.
```

```panel warn
title: stop sign 2, still ahead
After Phase 03, the owner's controlled blind score has to beat a plain-prompt score that is measured fresh. If it does not, the rival phases do not start and no money is spent on rivals.
```

## Where design sits in arc

- **Other lanes.** Three of the agent files, `ui-composer`, `design-jury` and `design-critic`, are shared
  with the `face` lane. Any edit to them sends that lane a note first.
- **The product.** The lane builds the `design` product, and its checking command is
  `/arc-design-critique`, which only looks and never edits.
- **Course changes.** New ideas arrive through `/arc-change`, and each phase closes only through
  `/arc-phase-done`.
- **Rule of thumb.** Agents judge, scripts measure (ADR-0048). A gate never asks an agent for a number a
  script can count.

# Meta

## Glossary

```gloss
Iteration: one turn of the drafter's render, look and revise loop. At most three per draft.
Iron law: the drafter's standing rule that it works only in its own folder, now with a short list of things it may also read (ADR-1415).
Loopback: a private address that only your own computer can reach. A draft is shown there so it cannot see a sibling draft's files (ADR-1418).
EXP-A1: the planned paired experiment that decides whether the drafter needs a stronger model (ADR-1400).
Sealed prediction: a guess written down and locked before a run, so it cannot be adjusted after the result is known.
Debt ledger: the lane's running list of shortcuts it accepted on purpose, kept in writing so none is forgotten (`initiatives/design/debt-ledger.md`).
```
