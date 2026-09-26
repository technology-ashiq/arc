# NOT SERVED — company ring

Phase 03, ring 5 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the company ring's six modules
that renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2 §5.2's table, is what
Phase 04 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every company module with nothing loaded
and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways, including the
sentence. The smoke counts the same panels in the page per room, per mood.

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `learn` | Playbook rules | `/api/learn` | Every rule the company has made of a correction it had to give twice, folded from the retro log, with recall search over them -- a lesson found in under two minutes or it is re-learned. |
| `learn` | Juror calibration | `/api/learn` | Each council juror's hit rate, Brier-scored against how the verdict turned out, and the weight that earns it -- no figure at all below the scoring floor. |
| `learn` | The sleeping queue | `/api/learn` | Every capability asleep until something pulls it, and the alarm that would wake it -- earn before build (A8), an alarm rather than a deadline. |
| `org` | Receipts per lane today | `/api/lanes` | Which lanes fired a receipt today, counted per lane -- so a lane whose header says IDLE and that emitted today reads awake, and one whose header says LIVE and fired nothing reads quiet. |
| `strategy` | The decision record | `/api/adrs` | Every ADR by its number and its lane's century, with its status and how reversible it is -- two-way, expensive, or one-way -- read from each file's own header. |
| `strategy` | Too expensive to revisit | `/api/adrs` | The one-way and expensive decisions, the ones a new plan has to live with rather than reopen, each with the ADR that made it. |

## What the ring reads from routes the door already serves

PLAN-face-v2 §5.2 gives `law`, `strategy`, `concepts` and `story` the allow-listed file route as their
source, and the ring reads those files through the door: `law` the constitution (its articles, precedence,
adoption line, amendment steps and teeth), `story` the logbook (every initiative, the milestones, each
closed cycle's chapter), `concepts` the contract's glossary, and `org` the portfolio's ADR band table —
which is how **F1** closes: the band map names the lane that owns each century, never the room the
contract homes it in. `org` and `strategy` read the lanes' own headers through `/api/board`, and
`law` counts its adoption receipts on `/api/spine`. `law`, `story` and `concepts` render **no NOT
SERVED panel**: their subject is a file the door serves whole.

`story` is a served room since the owner's PLAN-face-v2 §13 item 5 ruling gave it a registry row
(ADR-1337).
