# Verbs pending the work door — factory ring

Phase 03, ring 3 of 5 (face v2 Cycle 16, ADR-1326). Every write v0.7 drew as a button in these five
rooms, and this face does not perform yet: each renders as a dashed `data-verb-pending` card naming
Phase 05, never as a form that writes nothing. **This list, not a reading of the reference, is what
Phase 05 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every factory module with nothing
loaded and requires the rows below to EQUAL the `verbPending()` entries the folds return, both ways.
The smoke counts the same cards in the page per room, per mood.

| module | verb | what it will write, and where |
|---|---|---|
| `council-chamber` | Convene the council | Seats argue blind and in parallel, a verifier grades every point, one bounded rebuttal follows, and the verdict commits with its dissent. Convening arrives with the work door. |
| `design-studio` | Submit a surface | One surface goes out to three explores, each with a thesis it must differ by, before anything is judged. Submitting arrives with the work door. |
| `design-studio` | Run a critique, or convene the jury | The critique is read-only and may fail work for insufficiency, not only for breaking a rule; the jury ranks blind, with a reference item it is not told about. Both arrive with the work door. |
| `develop` | Open a slice | A named unit of the live phase, open until it is proven: tests green AND the owner saw it run. Opening and proving arrive with the work door. |
| `develop` | Close a phase on evidence | The close is refused unless the Definition of Done computes, and the refusal is itself a receipt that says what is missing. It arrives with the work door. |
| `review-ship` | Review a commit, or run qa | A review is keyed to the commit it read: a new commit is a new review. Running one from here arrives with the work door. |
| `review-ship` | Ship | A ship is the last gate passing, not a button that skips the others; loosening any gate asks you to say why, in writing. It arrives with the work door. |
| `toolbelt` | Pin a tool to the top of this room | A pin is a receipt, so the room remembers what the owner reaches for most. It arrives with the work door. |
