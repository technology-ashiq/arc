# Phase 07 close -- enforcement, board grammar, CI per job

## CI on the final code head `507cf1c9` (run 38528394609, PR #422)

Read per JOB from the job logs (`gh api repos/technology-ashiq/arc/actions/jobs/<id>/logs`), counting TAP
lines by each suite's test-name prefix, so a suite that never ran would read 0, not green:

| Job | kernel-freeze (29) | debt-budget (14) | lane-stale (20) |
|---|---|---|---|
| ubuntu-latest, 18 | 29 ok | 14 ok | 20 ok |
| ubuntu-latest, 20 | 29 ok | 14 ok | 20 ok |
| ubuntu-latest, 22 | 29 ok | 14 ok | 20 ok |
| macos-latest shards 1-3 | 29 ok (1/3) | 14 ok (3/3) | 20 ok (2/3) |
| windows-latest shards 1-12 | 29 ok (10/12) | 14 ok (9/12) | 20 ok (11/12) |

`not ok` across all three suites on every job: **0**. Each suite also carries a count guard (`this suite
registers every case it declares`), so a dropped `@test` fails the suite rather than shrinking it.

## Exit criteria

- Enforcement rows in `engine/enforcement.yaml`: `action-kickoff-kernel-lane` (advisory -- the freeze is the
  owner's ruling, read at kickoff), `action-kickoff-over-debt` (blocking, merge-time
  `tests/portfolio-debt-budget.bats::debt: no lane on this PR opens a cycle over its debt budget (the merge-time gate)`),
  `action-board-stale-field` (blocking, merge-time
  `tests/portfolio-lane-stale.bats::board-lint --strict: the committed board carries no hand-written stale field (the merge-time gate)`).
  `node .claude/scripts/core/gate-parity.mjs` -> `9 fragments, 7 rules, 25 rows, 0 gaps`.
- PORTFOLIO.md's table header lines and separator lines are byte-identical to `4741c770` (diffed; the
  separator lines hash the same, `5be871ab...`). No column added; `stale` is never written on the board.
- WARN registry: still nine classes (`board-lint.sh` pins them); the new check is a separate FAIL class,
  `board-stale-hand-written`, exit 1 only under `--strict`. `board-lint.sh --strict` on the real board exits 0;
  its two WARNs (growth's blocked-on prose, org's `sealed` cycle text) are on main already and not this lane's.
- `wiki-build.mjs --check`: `153 generated file(s) -- docs/wiki/ is exactly what the renderer writes`.
- Attack: two two-surface rounds (r1 @2df81d4, r2 @148c6aa), within the two-round cap; the spec's "one round
  per PR" was exceeded by one because round 1 found two highs. Findings and dispositions:
  `evidence/phase-04/live-demo.md`, `fixed-defects.md` (a)-(z), `debt-ledger.md` rows 1-6.
- Retro: `docs/retro-log.md` (two pattern lines + stat line), HISTORY C25; lane header IDLE and the board
  row rewritten in the same commit.
