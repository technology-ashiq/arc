# NOT SERVED — factory ring

Phase 03, ring 3 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the factory ring's eight
modules that renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2
§5.2's table, is what Phase 04 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every factory module with nothing
loaded and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways,
including the sentence. The smoke counts the same panels in the page per room, per mood.

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `agents` | Tiers and who is switched on | `/api/roster` | Each agent's tier -- cheap scan, balanced workhorse, high judgment, independent-family verifier -- and whether it is enabled, read from the agent's own frontmatter. |
| `council-chamber` | The verdict ledger | `/api/council` | Each verdict with the points behind it, the dissent it committed with, and the review-by date on which it is scored HIT or MISS. |
| `council-chamber` | Calibration | `/api/council` | The measured calibration of the calls this company has made: hits against misses, scored on the review-by date rather than claimed. |
| `design-studio` | The studio floor | `/api/design` | Each submitted surface with its three explore variants and their theses, the read-only critique's findings by class, and the blind jury's ranking against a reference item. |
| `develop` | Slices | `/api/slices` | Each slice of the live phase with its proof tier, the output that proved it and the commit it landed on, as the phase's task file records them. |
| `develop` | The Definition of Done | `/api/slices` | The close condition computed rather than asserted: every slice proven, tests green on CI, evidence bundled -- and the refusal that names what is missing when it is not. |
| `executor` | Hires on the books | `/api/roster` | Every contractor hired in engine/router.yaml with its four terms -- cap, hosted, judge and review_by, its tenure -- the decision that hired it, and the ones past their tenure date. |
| `executor` | Certification | `/api/roster` | The certification each hire passes before it is dispatched anything, fixture by fixture, and which fixture a failed one missed. |
| `executor` | Runs | `/api/roster` | Every dispatch with its outcome, its receipt and the judge's verdict on the draft it produced. |
| `factory` | Gate modes and the profile | `/api/gates` | What each gate is set to today -- blocking, advisory or off -- and the strictness profile that switches the whole set as one, parsed from the gates file. |
| `review-ship` | Gate modes and the profile | `/api/gates` | What each gate is set to today -- blocking, advisory or off -- the time budget it runs inside, and the strictness profile that switches the whole set as one, parsed from the gates file. |

Every route in the table above is the one `initiatives/face/contracts/modules-v2.json` already plans
for that module. The count of distinct routes is deliberately not written here: `listCheck` parses the
TABLE, so a number in this prose would be a claim nothing derives (Phase 03 attack).

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

The owner's PLAN-face-v2 §13 item 5 ruling (2026-09-18, ADR-1337) gave `factory` a registry row, so it is a
served room like any other: the floor of running cycles from the lanes' headers, the phase closings and
kickoffs the registry now homes in it, and the factory's parts counted from the registry. `executor` and
`agents` stay ADR-1327 exemptions: `module-exemptions.json` names both, the door serves that file on its
allow-list, and the shell draws each from its row with the not-in-registry label. Their rows above are the
hires, certification, runs and tiers that `/api/roster` will fold.

These three modules were built in the company ring's PR, after the ruling that unblocked them.
