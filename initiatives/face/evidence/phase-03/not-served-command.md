# NOT SERVED — command ring

Phase 03, ring 1 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the command ring's six
modules that renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2 §5.2's
table, is what Phase 04 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every command module with nothing
loaded and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways,
so a panel that stops being NOT SERVED, or a new one, fails CI until this file says so. The smoke
counts the same panels in the page per mood (`smoke: not-served mood=M panels=N rooms=...`).

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `board` | Ventures | `/api/ventures` | The kill-distance card for each venture: its stage, its criteria set at kickoff, and how far it is from its own kill line. The door serves no ventures route yet. |
| `today` | Policy | `/api/policy` | The ladder at a glance: each capability's autonomy level and the cap beside it. The door serves no policy route yet. |
| `today` | Learned this week | `/api/learn` | The calibration rules the owner's stamps taught the company this week. The door serves no learn route yet. |

**Routes named by this ring: 3** — `/api/ventures` · `/api/policy` · `/api/learn`.

## What the ring reads from routes the door already serves

`inbox` · `map` · `spine` · `ask-arc` render no NOT SERVED panel: every panel they carry reads
`/api/health`, `/api/inbox`, `/api/spine`, `/api/board`, `/api/lane/:id`, `/api/file/:id` or acts
through `/api/decide` · `/api/ask`, or draws from the served registry the shell already read.
Where v0.7 drew a panel from its simulated store and the door serves the underlying receipts, the
panel is folded from those receipts instead (the map's "live today", the board's pipeline, the
inbox's "where cards come from") and the module's View names the delta.
