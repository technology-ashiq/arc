# Handoff pack — phase 04 · lane evolve

8/8 slices proven.

## Prediction calibration

4 hit · 1 miss · 0 unforeseen

- **likely-failure-mode** — hit -- ea20ec1. Both halves were built as the two load-bearing tests precisely because they were predicted: an unresolved outcome is excluded and reported, and below floor renders insufficient evidence with no number reaching the screen
- **likely-regression-site** — hit -- ea20ec1. validate.mjs, and the regression was real: my own Phase-00 test asserted "closed 30" and went stale the moment this kind landed
- **riskiest-file** — miss -- ea20ec1. calibrate.mjs was clean. The break was in tests/evolve-receipts.bats, a file written three phases earlier
- **expected-blockers** — hit -- ea20ec1. council requires only core, so the spine import had to be made LAZY rather than load-time - the same lesson the design sandbox taught in Phase 01
- **expected-proof-failures** — hit -- ea20ec1. ADR-0309 predicted this drift by name ("anything that hardcodes 22 will drift"), and it was a literal 30 in my own test. Both vocabulary tests now read the count from KINDS

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - council.outcome emits and lands; both council payloads are CLOSED against unknown keys, case-varied enums, a bad session id, a bad date and a URL-shaped source_id | ea20ec1 |
| 02 | contract | contract - `council-calibrate --from-spine` scores from receipts through the reader | ea20ec1 |
| 03 | contract | contract - the REAL spine is asserted to carry ZERO scored council sessions, and the calibration reads insufficient evidence | ea20ec1 |
| 04 | contract | contract - bucket hit-rates and a Brier score render, with an empty bucket showing MISSING rather than 0 percent | ea20ec1 |
| 05 | contract | contract - a juror-weight change is proposed with its evidence and applied:false, and nothing is proposed on a calibration below floor | ea20ec1 |
| 06 | contract | contract - below floor the verdict is `insufficient evidence` and the Brier score is null, and the RENDER carries no number | ea20ec1 |
| 07 | contract | contract - hand-checkable arithmetic: 10 hits and 10 misses at High gives Brier ((0.85-1)^2*10 + (0.85-0)^2*10)/20, and an unresolved outcome is EXCLUDED not scored 0 | ea20ec1 |
| 08 | contract | contract - the full CI matrix | ea20ec1 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
