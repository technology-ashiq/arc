# NOT SERVED — factory ring

Phase 03, ring 3 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the factory ring's five
served modules that renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2
§5.2's table, is what Phase 04 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every factory module with nothing
loaded and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways,
including the sentence. The smoke counts the same panels in the page per room, per mood.

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `council-chamber` | The verdict ledger | `/api/council` | Each verdict with the points behind it, the dissent it committed with, and the review-by date on which it is scored HIT or MISS. |
| `council-chamber` | Calibration | `/api/council` | The measured calibration of the calls this company has made: hits against misses, scored on the review-by date rather than claimed. |
| `design-studio` | The studio floor | `/api/design` | Each submitted surface with its three explore variants and their theses, the read-only critique's findings by class, and the blind jury's ranking against a reference item. |
| `develop` | Slices | `/api/slices` | Each slice of the live phase with its proof tier, the output that proved it and the commit it landed on, as the phase's task file records them. |
| `develop` | The Definition of Done | `/api/slices` | The close condition computed rather than asserted: every slice proven, tests green on CI, evidence bundled -- and the refusal that names what is missing when it is not. |
| `review-ship` | Gate modes and the profile | `/api/gates` | What each gate is set to today -- blocking, advisory or off -- the time budget it runs inside, and the strictness profile that switches the whole set as one, parsed from the gates file. |

**Routes named by this ring: 4** — `/api/council` · `/api/slices` · `/api/gates` · `/api/design`;
each is the route `initiatives/face/contracts/modules-v2.json` already plans for its module.

## What the ring reads from routes the door already serves

`develop` and `design-studio` are lane rooms (`face/src/lib/lane-room.mjs`): their lane's PROGRESS
header and phase specs through `/api/lane/:id`, and the receipts of the kinds the served registry
homes in them through `/api/spine`. `council-chamber` and `review-ship` are rooms the registry gives
NO lane — the council is a company organ and every lane passes through the gates — so they draw no
lane panel and say so in the head, and their figures are counts of their homed kinds.

`toolbelt` renders **no NOT SERVED panel at all**: its subject is the served registry itself. Every
section — commands, agents, hooks, rules, lints, processes, gates, products, capabilities — is what
the registry says each room holds, with the room beside it, so the catalogue cannot know more or
less than arc does. The seats in the council chamber and the gate NAMES in review-and-ship come from
the same place; what is NOT SERVED there is each gate's mode and budget, which lives in a file no
route parses yet.

## The three `extra` rooms of this ring

`factory`, `executor` and `agents` (ADR-1327) are NOT in this PR and have no module folder. The ADR
keeps them as labelled modules, and `module-exemptions.json` is still empty, because the browser
cannot reach an unserved room: the rail is built from the served registry, and a module for a room
`/api/rooms` does not serve has no room facts to draw and no way to be opened. Giving them one is
either a registry row or a door route, and both are the owner's ruling at PLAN-face-v2 §13 item 5,
which Phase 05 already waits on. Carried as a debt-ledger row rather than solved by inventing a
fifth place for room copy to live.
