# Phase 02 evidence — scoring, council question, evolve feed

- **Fakes-first proof (CI, #350):** `discover-score.bats` (6 tests) and `discover-council.bats` (6 tests) pass.
  - REQ-03: byte-identical scores and per-row evidence. An ABSENT engagement is named, never 0 or NaN. A weight change without its sha is refused, and a weight change without an approved `discover-weights` decision is also refused.
  - REQ-04: the fixed 90-day question per finalist, with the N=0 and N=1 paths.
  - REQ-08: `council-calibrate --from-spine` scores a happened pair and excludes an unresolved one, with zero council or evolve code changed.
- **Live:** the 2026-10-06 mini-hunt was scored (33) and judged (2 finalists: `invoice-reminders-6e390c` score 51, `invoice-reminders-0553eb` score 44), with `run.completed` `01M48H6ZJMKB0A8B0320E5J0KP`.
- **Live council (2026-10-07, main clone):** the owner gave a written OK in chat for the `claude-code` driver, which runs on the subscription with no cash spend. `judge --in .claude/state/discover/real-hunt-2026-10-07 --emit --run --driver claude-code` ran 2 council-convene sessions in 1688 s. There is one `council.verdict` per finalist, and both were found by id in `events/2026-10-07.jsonl`, not in `_quarantine/`:
  - `invoice-reminders-6e390c` (score 51): **hold / Medium**. Session `c-007-invoice-reminders-first-paying-customer-90-days`, receipt `01M49BHH0N45KQSFT1BSB5YVTK`, question_hash `aa31a23e…c360`.
  - `invoice-reminders-0553eb` (score 44): **hold / Medium**. Session `c-008-invoice-reminders-first-paying-customer-90-days`, receipt `01M49CA9TAAN0YSC8WXXPFKY80`, question_hash `760218b7…ec8f`.
  - Judge `run.completed`: `01M49CARJEQ8JK13M1CMEVCYHX`. `verdicts --in` joined both back to their finalists by question_hash. The files are `../phase-03/judge.json` and `../phase-03/scores.json`.
