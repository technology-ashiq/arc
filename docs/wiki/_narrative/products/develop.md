<!-- facts: agents=11fa07ca commands=985b1f2d docs=4f53cda1 faceRing=785b1405 faceRoom=26771559 files=55f9cf64 requires=8ba3b34a scripts=39a1d961 version=8e633b4f -->
```tagline
The site foreman's clipboard. It hands out the building work one small room at a time, and it will not
let you move on until the last room has been checked and written down.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Somebody has already drawn the blueprint
(the plan). Somebody will inspect the finished building later (review and qa). This product covers the
long stretch in between: the actual building.

**develop is the foreman's clipboard, not the builder.** It never writes the code. The code is written
by the session you are working with. What develop does is keep the crew honest:

```panel big
- **Hand out one room at a time** (`/arc-develop`). The approved chunk of work is cut into small pieces. You get one piece, finish it, and only then get the next.
- **Say how you will prove it first.** Before any building starts, the piece has to say how anyone will know it works. "We will just see" is not accepted.
- **Stop and look at risky rooms.** If a piece touches something dangerous, like logins or payments, the clipboard forces an extra check right there.
- **Notice flailing.** If the same failure keeps coming back, the crew must stop guessing and find the real cause.
- **Write shortcuts down.** A corner cut on purpose goes on a list, so it is not a corner forgotten.

It also has a side desk (`/arc-capability`) for one question: "should we let this outside tool into the building?" That desk finds candidates and vets them. It installs nothing, ever.
```

### Why this needs to be a product at all

Without a clipboard, the crew does not fail loudly. It fails quietly, in three ways:

| What you lose | What it looks like when it bites | develop's answer |
|---|---|---|
| **Proof per room** | A whole phase is called done, and nobody can say which check covered which piece. | Each piece carries its own proof and its own saved commit. |
| **Memory of shortcuts** | A quick hack is taken under time pressure, then taken again, because nobody wrote it down. | A shortcut list. Each entry says what, where, why, and what event pays it back. |
| **Honesty about the same wall** | The team tries "a new idea" that is really the same failed idea, five times. | Repeated failures are recognised by shape and force a root-cause stop. |

> One rule sits under all of it: every number comes from a tool or from a scored result. A
> confidence figure the assistant invents about itself is not evidence.

## arc words → normal words

```lede
Six pieces of arc jargon. Each is an ordinary building-site thing wearing a technical name.
```

```rosetta
phase | one approved chunk of work | the unit `/arc-develop start` cuts into pieces
slice | one small room of that work | done only when it has real proof and a saved commit
ledger | the foreman's list of rooms | one file per phase, each room with its proof and result
tier | how strong the proof is | from a light static check up to real use of the real thing
checkpoint | an extra look at a risky room | runs by itself when a piece touches a sensitive area
receipt / the spine | one line in arc's logbook saying "this happened" | written when work starts, when a room is proven, when it is handed over
```

## How a job flows

```lede
The road is a loop: take a room, prove it, commit it, ask for the next. The end of the road is a
handover, not a finish line.
```

```flow
source: an approved phase
box: ① Start | /arc-develop start
box*: ② Build a room | you + the proof
box: ③ Next room | /arc-develop next
box: ④ Hand over | /arc-develop handoff
labels: cut into rooms, proven, all done
out: no spec file | stop, nothing written
out: risky room | checkpoint first
out: same failure again | root-cause stop
out: a prediction unscored | handover refused
divider: 3 | building | handing over
note: develop never closes the phase. It hands the evidence to /arc-phase-done and stops.
caption: Figure 1 — from an approved phase to a handover. | The loop between the second and third box repeats once per room.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: Cutting the phase into rooms
plain: It reads the phase's own description and makes one room for each thing that must be true at the end. If that description is missing, it refuses and writes nothing.
d: `start` reads the phase spec, fills the header of the phase ledger from it, and writes one slice per exit-criteria checkbox with the proof fields still blank. It also writes a `develop.started` receipt.
f: `.claude/scripts/develop/develop.mjs`

t: Building one room
plain: You sketch a tiny plan, say how you will prove the room works, build it, run the proof, and paste in what really happened. Then you save the room as a commit.
d: Micro-plan, then fill `proof:` and `tier:` before any code, implement, paste the real output into `result:`, commit locally and record the SHA in `commit:`. develop never runs git for you (ADR-0102).
f: `.claude/commands/arc-develop.md`

t: Asking for the next room
plain: The clipboard checks the last room really has proof and a commit, records that it is done, and only then hands out the next one. If that room was a risky one, it stops for an extra look first.
d: `next` emits the `slice.done` receipt, then runs the checkpoint inline when the diff touches a risk area such as auth, migrations, the public API, payments or the gate scripts themselves (ADR-0103).
f: `.claude/scripts/develop/quality.mjs`

t: When a room keeps failing
plain: Each failed attempt is written down. The same failure three times in a row means stop guessing and find the cause. Five attempts on one room means stop and ask for a decision, with a one-screen summary.
d: `stuck.mjs` reduces an error to a fingerprint, counts attempts per slice, and emits a `slice.stuck` receipt whenever a limit fires.
f: `.claude/scripts/develop/stuck.mjs`

t: Handing over
plain: Every prediction made at the start must be marked hit, miss or unforeseen (something nobody predicted at all). A fresh reader, who has seen only the spec and what was built, checks the two match. Then the evidence pack is written, and the clipboard stops.
d: `handoff` refuses until the predictions are scored, runs the `spec-fidelity` agent on the spec and the diff only, and assembles the pack for `/arc-phase-done`.
f: `.claude/agents/spec-fidelity.md`
```

# The bigger loop

## A short story

A phase says "let people reset their password". The clipboard cuts it into rooms: the form, the email,
the new-password page. On the third room the piece touches a file with `auth` in its path, so before the
fourth room is offered, the checkpoint fires and looks at exactly what changed.

Then a test fails the same way three times. The crew is not allowed a fourth "small tweak". It has to
find the cause, and it does: the email link expired too early. At the end, the fresh reader is given
only the spec and the diff. It reports that the spec also said "for a week", and nothing built shows
that. One more room is added. Only then does the handover go to `/arc-phase-done`.

## Lessons written down

When something goes wrong that the process should have caught, it goes into the learning ledger
(`docs/develop/learning-ledger.md`): what failed, why nothing caught it, and a proposed safeguard. A
lesson is never promoted on its own say-so. It needs replay results, a verdict from a fresh reader, and
a recorded approval (ADR-0108, ADR-0109).

## The side desk for outside tools

`/arc-capability` has two halves in a fixed order. A scout agent (`capability-scout`) finds candidates
and writes nothing. A gate (`.claude/scripts/develop/capability-vet.sh`) refuses by default. Between them
sits you, because letting something into the building is a decision, not a step. The gate judges on
where a tool came from, not on how popular it is (ADR-0110).

## Proving a room from the face

The one step `/arc-develop` leaves to the session is filling a room's result and commit. The face can start that for you, after a click of yours, through the `develop-proof` process. It proves the next unproven room from evidence already recorded, and ends on a `slice.done` receipt.

## Where develop sits in arc

- **Between plan and audit.** `/arc-kickoff` makes the plan. `/arc-develop` builds against it.
  `/arc-phase-done` closes the phase.
- **A new idea mid-build goes elsewhere.** develop sends it to `/arc-change` rather than acting on it.
- **It needs `core` and `hq`.** The chips at the top of this page name its room and ring.

# Meta

## Glossary

```gloss
slice: one small, separately proven piece of a phase.
fingerprint: a short code for the shape of an error, so the same failure can be recognised twice.
checkpoint: an extra automatic check when a piece touches a sensitive area.
debt ledger: the list of shortcuts taken on purpose, each with the event that pays it back.
holdout: test material kept away from whoever writes a safeguard, so they cannot tune to it.
```
