# Phase 02 evidence — scoring, council question, evolve feed

- **Fakes-first proof (CI, #350):** `discover-score.bats` (6 tests) and `discover-council.bats` (6 tests) pass.
  - REQ-03: byte-identical scores and per-row evidence. An ABSENT engagement is named, never 0 or NaN. A weight change without its sha is refused, and a weight change without an approved `discover-weights` decision is also refused.
  - REQ-04: the fixed 90-day question per finalist, with the N=0 and N=1 paths.
  - REQ-08: `council-calibrate --from-spine` scores a happened pair and excludes an unresolved one, with zero council or evolve code changed.
- **Live:** the 2026-10-06 mini-hunt was scored (33) and judged (2 finalists: `invoice-reminders-6e390c` score 51, `invoice-reminders-0553eb` score 44), with `run.completed` `01M48H6ZJMKB0A8B0320E5J0KP`.
- **NOT yet run:** the live council sessions (`judge --run --driver …`). That is a paid run and needs the owner's written OK with an amount (REQ-07 precondition, A-04). Until it runs, REQ-04's live half and the two real `council.verdict` receipts are owed.
