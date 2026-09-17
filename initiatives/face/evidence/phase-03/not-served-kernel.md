# NOT SERVED — kernel ring

Phase 03, ring 2 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the kernel ring's eight
modules that renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2 §5.2's
table, is what Phase 04 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every kernel module with nothing
loaded and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways.
The smoke counts the same panels in the page per mood, summed with the command ring's.

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `absorb` | The registry | `/api/absorb` | Every technique arc has looked at, as candidate, trial, adopted or retired, with the report and the blind judgement behind each move. |
| `absorb` | Adopted per lane | `/api/absorb` | The techniques adopted in each lane, counted against the per-lane cap the registry enforces. |
| `bench` | The bench | `/api/bench` | Champion and challenger scorecards per driver over the fixtures, every number derived from scored runs, with NO PROPOSAL as a first-class result. |
| `engine-room` | Drivers, routers and budgets | `/api/engine` | The driver table, the router row for every task class, and each capped budget, parsed from engine/router.yaml. The door serves that file as text today; its parsed table arrives with this route. |
| `evolve` | Experiments | `/api/evolve` | Each experiment's declared surface, metric and hypothesis, both arms against the sample floor, the holdout, and the verdict once both arms reach the floor, folded from its receipts. |
| `evolve` | Experiment contract | `/api/evolve` | The evolve section of a process manifest: its surface, metric, sample floor and holdout, as the manifest declares them. |
| `memory` | Lessons | `/api/memory` | Every lesson with the number of times it was corrected, the ones already promoted to rules, and the ones proposable now, folded from the retro log. |
| `memory` | Recall cost | `/api/memory` | What one recall costs today, measured by the recall golden gate rather than estimated. |
| `model-policy` | The tier table | `/api/model-policy` | Each tier as a job description first and the model that implements it second, parsed from the tier block of engine/router.yaml. |
| `model-policy` | Process routes | `/api/model-policy` | Every process class with its tier, its driver and fallback chain, and a contractor's cap, judge and review-by date, parsed from engine/router.yaml. |
| `model-policy` | Egress allowlist | `/api/model-policy` | The exact host and port each driver may reach, parsed from the router file's egress block. |
| `policy` | The subject table | `/api/policy` | One row per subject -- each process, and the interactive session -- with every capability pair's ceiling, cap and effective level, parsed from hq.policy.yaml. |
| `policy` | The ladder | `/api/policy` | Each capability's rung, from observe to acting with a weekly digest, with the trial-ledger evidence that earned it. |
| `scheduler` | Next fire and cadence | `/api/jobs` | Each job's cadence -- daily or weekdays at a time, in IST -- its next fire, and its overdue mark at twice the cadence, parsed from hq.jobs.yaml. |
| `scheduler` | The heartbeat | `/api/jobs` | The clock's own proof of life: each job judged against its cadence, and a silent clock raised as an incident rather than inferred from the newest receipt. |

**Routes named by this ring: 8** — `/api/engine` · `/api/model-policy` · `/api/policy` · `/api/jobs` ·
`/api/memory` · `/api/evolve` · `/api/bench` · `/api/absorb`; each is the route
`initiatives/face/contracts/modules-v2.json` already plans for its module. `/api/policy` is shared
with the command ring's Today panel.

## What the ring reads from routes the door already serves

Every kernel module is a lane room (`face/src/lib/lane-room.mjs`): its lane's PROGRESS header and
phase specs through `/api/lane/:id`, the receipts of the kinds the served registry homes in it
through `/api/spine` (a comma list of kinds), and what it holds from the registry the shell already
read. Where the door allow-lists the file a table will be parsed from — `engine/router.yaml`,
`hq.policy.yaml`, `hq.jobs.yaml`, `docs/retro-log.md`, `docs/trial-ledger.md` — the module shows that
file's path, sha256 and size through `/api/file/:id`: provenance only, never its content as a table.

Where the door holds the receipts behind a panel, the panel is folded from them instead: the
scheduler's jobs and their last outcome (run.completed naming a `job`, closing Cycle 15 finding F2
together with the two `/api/jobs` rows above), the engine room's runs by process, the bench's runs by
driver, and every room's counts by kind.

## Verbs pending the work door

Every write v0.7 drew in these rooms — propose a tier, propose a cap or demote, declare a subject,
register / fire / pause a job, log a correction, recall, open an experiment, add a model to the
bench, absorb a candidate — renders as a `data-verb-pending` card naming Phase 05 (ADR-1326), never
as a button that writes nothing. The engine room's key field is not a pending verb: no provider key
lives in the browser, ever (ADR-1325).
