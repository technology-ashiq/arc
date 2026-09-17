# Verbs pending the work door — kernel ring

Phase 03, ring 2 of 5 (face v2 Cycle 16, ADR-1326). Every write v0.7 drew as a button in these eight
rooms, and this face does not perform yet: it renders as a dashed `data-verb-pending` card naming
Phase 05, never as a form that writes nothing. **This list, not a reading of the reference, is what
Phase 05 builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every kernel module with nothing
loaded and requires the rows below to EQUAL the `verbPending()` entries the folds return, both ways
(the same walk that derives the NOT SERVED list). The smoke counts the same cards in the page per
mood, per room.

| module | verb | what it will write, and where |
|---|---|---|
| `absorb` | Absorb something | A candidate tool, skill, repo or dependency is captured, studied read-only, reported and vetted before anything installs. Capture arrives with the work door. |
| `bench` | Add a model to the bench | A model joins as a challenger, runs its scorecard, and a win becomes a promotion proposal in your inbox. Every step arrives with the work door. |
| `evolve` | Open an experiment | One declared surface, one metric, one hypothesis, written before the first batch. Opening, measuring and concluding arrive with the work door. |
| `memory` | Log a correction | A correction is counted against its earlier repeats by its normalized text; the second one makes it proposable as a rule. Logging arrives with the work door. |
| `memory` | Recall | How did we get burned by this before: a fold over the lessons, the trial ledger and the receipts, with no model and no spend. It runs through the work door. |
| `model-policy` | Propose a tier change | A tier change is a reviewed diff to the router file citing ADR-0069, raised to your inbox for a stamp; the route keeps its tier until you stamp. The face raises it once the work door exists. |
| `policy` | Propose a cap, or demote a pair | A cap rises only on your stamp, citing trial-ledger evidence; a demotion needs no key at all. Both reach the policy through the work door. |
| `policy` | Declare a subject | A new subject is a reviewed diff to hq.policy.yaml and is born at the lowest acting level: no row in the policy file, no job. |
| `scheduler` | Fire now, pause or resume a job | A fire is idempotent per slot, and a pause lets the slot pass with no catch-up. Both are verbs of the work door; today the clock runs from hq.jobs.yaml alone. |
| `scheduler` | Register a job | A job is a reviewed diff to hq.jobs.yaml that names a policy subject, and jobs-lint refuses an illegal schedule before anything runs unattended. |


The engine room's provider-key field is NOT on this list and never will be: no key lives in the
browser (ADR-1325), so its removal is a declared delta, not a pending verb.
