# Handoff pack — phase 08 · lane develop

9/9 slices proven.

## Prediction calibration

3 hit · 1 miss · 1 unforeseen

- **likely-failure-mode** — hit — and it was live. `false-block-rate` printed 0 on this repo while the trial ledger held five rows reading `unadjudicated`, `unadjudicated, leaning false` and `n/a — not counted as a clean run`. They went into the denominator and a perfect gate record came out
- **likely-regression-site** — hit — all 20 findings were in the readers. Fences, column positions, prose matched as verdicts, file order mistaken for time order, and a lane field ignored entirely
- **riskiest-file** — hit — metrics.mjs took every finding; develop-lint took two of its own and no other file had any
- **expected-blockers** — miss — `not derivable` was the easy half, because the shape makes a reason mandatory. The hard half was the opposite: deciding when a number that COULD be computed should not be, which is what the unadjudicated rows and the 90-day ceiling are
- **expected-proof-failures** — unforeseen — the fixture's numbers were right first time. What failed twice was my own FIX: a median of two values is the mean, and `` sits inside `hit-and-miss` right where the hedge splits

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - `bats tests/develop-metrics.bats` asserts each of the six against a number derived by hand from a fixture built to produce it | a52a4b2 |
| 02 | contract | contract - `bats tests/develop-metrics.bats` over a fixture holding none of the records, asserting a null value AND a non-empty reason for every metric | a52a4b2 |
| 03 | contract | contract - `bats tests/develop-metrics.bats` asserts the totals AND the per-field breakdown against a hand count | a52a4b2 |
| 04 | contract | contract - `bats tests/develop-metrics.bats` asserts a free-text tag FAILs and each of the five passes | c25e5c1 |
| 05 | contract | contract - `bats tests/develop-metrics.bats` asserts a tagged row IS retrieved by its tag and a differently-tagged row is NOT | a52a4b2 |
| 06 | contract | contract - `bats tests/develop-metrics.bats` over a complete suggestion, one with no default, one with no evidence, one priced in time, and one raised mid-slice | c25e5c1 |
| 07 | contract | contract - every check has its negative control in `bats tests/develop-metrics.bats`: the metric that computes and the one that refuses, the tag that passes and the one that fails, the retrieval that fires and the one that stays silent | 27cb7ce |
| 08 | verified-real | verified-real - a fresh agent that never saw the code found 20 holes, 13 of them wrong numbers reported as real, and one live on this repo | c25e5c1 |
| 09 | integration | integration - CI run 30782174344 green on all 3 legs at head 27cb7ce | 27cb7ce |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
