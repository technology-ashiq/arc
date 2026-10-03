<!-- facts: appetite=5ba4c16b blocked-on=a68c9074 burn=1858658b cycle=9864c386 depends-on=a68c9074 hasPlan=b5bea41b phase=50fd1513 status=8ddd7aee title=579bedfe -->
```tagline
The front office of arc. One screen where the owner sees the company and decides, instead of opening
binders one at a time. Every room on it reads what arc already knows and writes only through the doors arc already has.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. For a long time it ran on binders,
spreadsheets and a shared logbook. It worked, but to see the whole business the owner had to go and
open each binder.

**face is the front office being built for that company.** It is the browser screen (arc calls it "the
room UI"). Each room on the screen shows one part of the business: the inbox of decisions, the map,
the logbook, the money. The owner walks in, sees the state of things, and answers the day's questions
there.

```panel big
**The front office has no private files.** A room may only show what the reception desk (the read door) hands it, and may only change something by going through a door arc already had (the work door, the session door). If a room has nothing to show, it says so on the screen. It never makes something up.
```

### What this lane is for

The lane's plan (`initiatives/face/PLAN.md`) says the goal in one sentence: the owner's design becomes
arc's real screen, so the owner runs the company's daily decisions and its routine work from one place.
And the next new part of arc gets a working room by adding one folder, with no redesign.

The plan also records why this matters. An earlier version of the screen arrived late, so the owner
kept deciding in the command line. The lane exists so that the screen is where the decisions happen.

### Two cycles, one lane

The lane has built twice. The first cycle made a working screen. Then the owner supplied his own
finished design, and the lane made that design the reference (ADR-1318). The current cycle, "The
Workroom", rebuilds the screen to match it. The old cycle's record is kept in the lane's archive folder.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary front-office thing wearing a technical name.
```

```rosetta
room | one screen in the office | one part of arc, such as the inbox or the map
module | the folder behind a room | four parts: what it is, how it decides, what it may do, how it looks
read door | the reception desk | hands rooms facts and never lets them write (`/api/rooms` lists the rooms)
work door | the outgoing mail desk | runs the same real tool a person would run by hand, in two steps: `plan`, then `apply`
session door | the phone line | starts a long job, such as convening a council, only from a click
NOT SERVED | a sign saying "no data here" | shown when a panel has no read route, instead of invented facts
residue | a job found but filed to its owner | a gap the phase named and handed to the lane that owns the fix
birth rule | new department, new office | a new part of arc gets a room by adding one folder
```

## How one visit works

```lede
Looking is free and changes nothing. Doing goes through a door arc already trusts, and leaves a
receipt on the logbook.
```

```flow
source: the owner opens a room
box: ① Room opens | asks for its facts
box: ② Read door | serves the facts
box: ③ Owner presses a verb | plan, then apply
box*: ④ Work door | runs the real tool
labels: asks, shown, confirmed
out: no read route | panel says NOT SERVED
out: -
out: -
out+: receipt | on arc's logbook
divider: 2 | only looking | something changes
note: There is no second path. What the face does is what a person typing the command would do.
caption: Figure 1 — one visit to a room. | The dashed line is where looking ends and changing begins.
```

## The parts, one by one

```lede
Each part is written twice: first in ordinary words, then what actually exists.
```

```steps
t: The rooms
plain: Each room is a folder with four small parts. The list of rooms is handed out by the office, so a new room shows up by adding a folder.
d: Modules live in `face/src/modules/`. The served list is `initiatives/face/contracts/rooms.generated.json`, and `face-coverage` fails when a module or a served room has no partner (ADR-1306).
f: `face/src/modules/`

t: The reception desk
plain: Rooms read from one desk. If a room asks for something the desk does not serve, the room shows NOT SERVED.
d: `/api/rooms` and the other read routes are served by arc's dashboard server. Phase 04 served the gaps it could and filed the rest as residue the owner approved as a whole (ADR-1338).
f: `.claude/scripts/hq/arc-dash.mjs`

t: The work door
plain: Every verb the owner can press runs the real tool, with no second copy of the logic. The decision path is the very same function the command line uses.
d: One write path, `/api/decide`, is the `arc-inbox` function itself (ADR-1302). ADR-1339 widened the work door to every verb.
f: `docs/adr/1339-fv2-flagship-six-and-every-verb-works.md`

t: The session door
plain: Long jobs, such as convening a council, start only from a click. The result is a receipt the face can read back.
d: A session starts only through `arc-run --driver`, never a raw binary (ADR-1326, ADR-1345). The council convene runs as the `council-convene` process. Some verbs read their receipt back, some do not yet, and some were filed as residue.
f: `initiatives/face/phases/phase-06-spec.md`
```

# The bigger loop

## How a phase is proven

```lede
A phase is finished only when the proof is on the table, and the office will not admit a room it
cannot check.
```

The lane is built room by room and door by door. Two checks run on every module: `face-pure` (the
deciding part must run with no browser at all) and `face-coverage` (no orphan room, no blank served
room). `/arc-face-module` builds a new module already passing both. A phase closes only through
`/arc-phase-done`, with the tests green on CI, a live look, and the tracker updated.

## A visit, as a story

```loop
top: 1 | the owner
top: 5 | the logbook
stage: 1 · Decision waits | shows in the inbox room
stage: 2 · The owner reads it | the room shows facts from the read door
stage: 3 · The owner answers | approve or reject, with a reason
stage*: 4 · Work door runs it | the same tool as by hand
stage!: 5 · A receipt lands | the room reads it back
labels: opened, read, pressed, recorded
back: last -> 1 | the next decision shows up
caption: Figure 2 — one decision made in the face. | The receipt is the proof it really happened.
```

1. A decision is waiting in the inbox room.
2. The owner opens it and reads the facts on the screen.
3. He presses approve or reject and gives a reason.
4. The work door calls the real tool.
5. A receipt is written on the logbook, and the room shows it.

*This story is an illustration of how a visit runs. It is not a real record.*

## Where it stands

The tracker (`initiatives/face/PROGRESS.md`) holds the live numbers in the generated sections. In
words: the look, the rooms, the read door, the work door and the session door are each built and
closed through Phase 06.

Phase 07 is now the work in hand. It puts arc's own docs wiki inside the face as a Reference room, with
a Reference link from every room. The pages there follow a new page shape. Their explanations are
checked by `narrative-anchors`, which fails when a named path, command or decision does not exist, and
each page waits for the owner to read and accept it (the `narrative-verify` harness is advisory). The owner has read one sample page (the qa
product page) and said it is good. The other pages come after that.

What is next: finish the Reference room, then Phase 08, the dogfood. Dogfood means the owner runs the
company's real decisions through the face on two real days, to prove it can be operated.

## How it connects to the rest of arc

- **The logbook.** Everything the face changes lands as a receipt on the same logbook as the rest of arc.
- **The docs lane.** The Reference room reads the docs wiki's own extract, and the page rules come from
  ADR-1514 and ADR-1347.
- **Every other lane.** A new lane or product gets a room through the birth rule, and a gap the face
  cannot close is filed to the lane that owns it.

# Meta

## Glossary

```gloss
mood: dark or light. Both are checked for every room.
ring: a group of rooms, built and merged together.
dogfood: using the product for real. Here, two real days of decisions made through the face.
face-pure: the check that a module's decisions run with plain node and no browser.
face-coverage: the check that every module and every served room has its partner.
```
