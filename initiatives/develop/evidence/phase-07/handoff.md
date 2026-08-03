# Handoff pack — phase 07 · lane develop

9/9 slices proven.

## Prediction calibration

4 hit · 1 miss · 0 unforeseen

- **likely-failure-mode** — miss - the checks did not fire too widely, they could not fire at all. Any ledger carrying two approach sketches was BLOCKed by seven `brief repeats key` errors, because approach fields collided with the brief namespace. The feature was unusable and no test exercised it end to end
- **likely-regression-site** — hit - every structural hole was in the section finders. Fences were live structure, duplicate sections were last-wins, a section naming an unknown slice was never validated, and an annex between slices swallowed every slice after it
- **riskiest-file** — hit - all 21 findings were in quality.mjs; no other file had any
- **expected-blockers** — hit — and the second half was the harder one. `a 30 day session TTL` and `adds 2 minutes to every CI run, measured` were flagged as invented costs on auth slices, where token lifetimes ARE the design. The ban applies to the economics fields only now
- **expected-proof-failures** — hit - it failed in BOTH directions at once, missing `half a year`, `6mo`, `a couple of sprints` and `6 person-months` while flagging measured facts, and it was a denial of service besides (16.8s on 3000 spaces, scaling cubically)

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - `bats tests/develop-quality.bats` asserts both directions: a slice declaring a decision owes an annex, and a slice declaring none is FAILED for carrying one | c1518f0 |
| 02 | contract | contract - `bats tests/develop-quality.bats` over a row with no source and a row whose verdict is `interesting` | c1518f0 |
| 03 | contract | contract - `bats tests/develop-quality.bats` over a 24-row annex, and over the same annex split under two headings | f044b18 |
| 04 | contract | contract - `bats tests/develop-quality.bats` asserts a risk-glob slice WARNs and a non-risk slice is silent | f044b18 |
| 05 | contract | contract - `bats tests/develop-quality.bats` over `~6 months`, and over `touches 3 call sites` / `deps +0, services +1, config +2` | f044b18 |
| 06 | contract | contract - `bats tests/develop-quality.bats` over a rejected approach with no `rejected-because`, and over zero and two picked | f044b18 |
| 07 | contract | contract - every check in `bats tests/develop-quality.bats` is asserted to FIRE on its case and STAY SILENT on the other | c1518f0 |
| 08 | verified-real | verified-real - a fresh agent that never saw the code found 21 holes, including a design error that made the feature unusable | f044b18 |
| 09 | integration | integration - CI run 30775054470 green on all 3 legs at head 34ef15d | 34ef15d |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
