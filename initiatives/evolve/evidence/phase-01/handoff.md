# Handoff pack — phase 01 · lane evolve

12/12 slices proven.

## Prediction calibration

2 hit · 2 miss · 1 unforeseen

- **likely-failure-mode** — hit -- 55f5d0d. A reducer counting an uncollected window as zero was exactly the defect, and it was the FIRST thing the load-bearing test pinned. It was not the only one: the fresh agent found 14 more, so the prediction was right and nowhere near sufficient
- **likely-regression-site** — miss -- 65972e9. I said the emitter and validators, on the reasoning that the board only reads. The regression was INSIDE the board: an order dependency in its own fold, and the reader handing back {event,day,seq} rows rather than events
- **riskiest-file** — hit -- 55f5d0d. board.mjs took all 15 breaks
- **expected-blockers** — miss -- 65972e9. "The board only reads, so it cannot corrupt the spine" is true and irrelevant: a board that reads WRONG is a board that lies, and three CI rounds were spent on it
- **expected-proof-failures** — unforeseen -- 63ddb93. Red-before-green happened as predicted. What I did not predict is that four of my OWN hole-pinning tests would fail on a DUP_IDEM -- the emitter correctly refusing fixtures I had built wrong, because `arm` is not in the measured idem

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - `spine-reader-lint.sh` globs .claude/scripts/evolve as well as hq, and a bats case asserts BOTH that the lint passes and that it actually covers this directory | 65972e9 |
| 02 | contract | contract - two same-ts receipts from different actors are written to a day file in BOTH orders and the two boards are diffed | 65972e9 |
| 03 | contract | contract - an experiment below floor renders PENDING with n/floor per arm | 65972e9 |
| 04 | contract | contract - a regex assertion that the age is `<n>d ago`, not a bare stale flag | 65972e9 |
| 05 | contract | contract - THE load-bearing case: 3 units measured for +champion, 2 of them in a window where +challenger-a reported nothing; the board must print 1, not 3 | 65972e9 |
| 06 | contract | contract - a below-floor arm renders `insufficient evidence: <arm> n<floor>` | 65972e9 |
| 07 | contract | contract - experiment panels read experiment.measured only; the baseline path is proven ONLY against MISSING | 65972e9 |
| 08 | contract | contract - the baseline row renders MISSING and names ADR-0308, and the ROW IS PRESENT rather than omitted | 65972e9 |
| 09 | contract | contract - an empty spine asserts no ` 0/` anywhere, and a hostile manifest is REJECTED rather than rendered | 65972e9 |
| 10 | contract | contract - `bats tests/evolve-board.bats` on the full CI matrix | 65972e9 |
| 11 | verified-real | verified-real - `arc-evolve board` run against a real sandboxed spine, output read | 65972e9 |
| 12 | static | static - PROGRESS.md row + done-log, PORTFOLIO row, board-drift green in CI | 65972e9 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
