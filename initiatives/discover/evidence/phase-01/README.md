# Phase 01 evidence — hostile hunt on fakes + live mini-hunt

- **Build PR:** #350 squash-merged as `e959e0b1` on 2026-10-06. CI run 37429716067 was 19/19 green, read per job with `ci-digest.mjs` and the head SHA `5854060f` asserted.
- **Red history:** run 37426060325 failed on three causes, all fixed before the merge:
  - Node 18 has no `toWellFormed`.
  - A negated letter range in `judge.mjs` tripped `portability.bats`.
  - The tests still expected the stub CLI's messages.
- **Fakes-first proof (CI):** `discover-miner.bats` (11 tests) and `discover-cluster.bats` (7 tests) pass. The recorded real response (`tests/discover/fixtures/recorded/hn.json`, 3 requests, 43 records) replays through growth's own adapter. `clusters.json` sha256 `4bc7da14…` equals the committed golden on every OS leg.
- **Live mini-hunt** (main clone, 2026-10-06, niche `invoice reminders`, 3 public HN requests at 1 req/s, ₹0):
  - 45 records in 33 clusters; `live-clusters.json` sha256 `6d40daaa2deaaf20d9fdb7c021c8d041d04257df19f20273021cafc1d2bd63e2`.
  - **45 `idea.captured` receipts** on `events/2026-10-06.jsonl` (production count, `process=discover@0.1.0`), plus `run.completed` `01M48H6KPAVQQZ5PGJKHVM1FTC`.
  - `_quarantine/` holds 0 files containing `discover@`.
  - Downstream on the same snapshot: `score` scored 33 clusters, and `judge --emit` named 2 finalists (`live-judge.json`) and emitted `run.completed` `01M48H6ZJMKB0A8B0320E5J0KP`.
- **Day-4 kill question:** answered NO-KILL. The hostile fixture hunt is byte-identical across runs and OS legs, and every injection fixture is refused closed (`discover-miner` hostile + inert arms, `discover-cluster` escaped-data arm).
- **Attack:** the build diff got two rounds (`../phase-00/attack-dfe58d2-*`, `attack-9d389cc-*`); all highs fixed. Logic r2 RUN FAILED with the cause unprinted, and the round cap was reached.
