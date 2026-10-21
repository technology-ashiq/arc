# Verbs pending the work door — company ring

Phase 03, ring 5 of 5 (face v2 Cycle 16, ADR-1326). Every write v0.7 drew as a form in these six rooms,
and this face does not perform yet: each renders as a dashed `data-verb-pending` card naming Phase 05,
never as a form that writes nothing. **This list, not a reading of the reference, is what Phase 05
builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every company module with nothing loaded
and requires the rows below to EQUAL the `verbPending()` entries the folds return, both ways. The smoke
counts the same cards in the page per room, per mood.

| module | verb | what it will write, and where |
|---|---|---|
| `concepts` | Define a term | A term is homed in a room and a station on its line, as a reviewed edit to the contract -- the palette finds it the moment it lands. It arrives with the work door. |
| `org` | Set a lane's status | A lane's status is its PROGRESS header; changing it -- awake, idle, blocked on a named thing -- is a reviewed edit that lands as a receipt. It arrives with the work door. |
| `org` | Birth a lane | Only /arc-kickoff births a lane: it claims the next ADR century and lands the lane's room in the same change. The work door will start that ceremony from here. |
| `strategy` | Adopt a plan | A plan becomes a lane's live plan at /arc-kickoff, and the lane's previous plan becomes history in the same change; the adoption is a receipt. It arrives with the work door. |
| `strategy` | Record an ADR | An ADR takes the next free number in its lane's century, never the company's highest-plus-one, and lands as a reviewed file. It arrives with the work door. |

`law`, `learn` and `story` offer no verb, as the plan gives them none: an amendment is the owner's, by
the CLI, after a cooling period; a lesson is logged by `/arc-retro`; the logbook is written when a cycle
closes.
