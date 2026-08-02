# Handoff pack — phase 05 · lane develop

9/9 slices proven.

## Prediction calibration

3 hit · 2 miss · 0 unforeseen

- **likely-failure-mode** — miss — the one-hop boundary never leaked. A fresh agent tried to make it, pointing a matched row's `rule:` at the learning ledger itself, and got nothing: the target is never opened, so there is no path to cross. The prediction named the right risk and the wrong mechanism
- **likely-regression-site** — hit — `modeNext`'s new write was the defect. Binding by slice id rather than by the reader's line sent one slice's pack into another slice's audit trail whenever an id was duplicated, found by the fresh pass and fixed with `at:`
- **riskiest-file** — hit — context-pack.mjs took 20 of the 23 holes, and every one of its four markdown readers had at least one
- **expected-blockers** — hit — codegraph never ran for real here, and the fake was the only exercise of that leg; `git log` did differ across platforms, though by C-quoting non-ASCII names rather than by pathspec quoting
- **expected-proof-failures** — miss — the churn test's git identity was right first time because the retro-log entry was read before writing it. What failed instead was nine probes importing a Git Bash path node cannot resolve, and three of those PASSED while doing nothing

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | integration | integration — `bats tests/develop-context-pack.bats` asserts `next` on the fixture tree prints a Context Pack naming all five sources by name | 7863710 |
| 02 | contract | contract — `bats tests/develop-context-pack.bats` runs the same tree twice, once with a fake codegraph plus `.codegraph/` and once without, asserting the printed path name differs and is never absent | 7863710 |
| 03 | contract | contract — one shared assertion block in `bats tests/develop-context-pack.bats` is run against both adapters: repo-relative paths, sorted, deduped, capped, and a named `ran` in both | 7863710 |
| 04 | unit | unit — `bats tests/develop-context-pack.bats` seeds a ledger where the two-hop item is unreachable in one arrangement and one-hop-reachable from a second matched row in the other, and asserts absent then present | 7863710 |
| 05 | unit | unit — `bats tests/develop-context-pack.bats` builds a history whose per-file commit counts are known by construction and asserts the printed top 3 and their counts | 7863710 |
| 06 | integration | integration — `bats tests/develop-context-pack.bats` reads the ledger file back after `next` and asserts the `sources:` line names all five sources, with a zero-count source present rather than omitted | 7863710 |
| 07 | contract | contract — `bats tests/develop-context-pack.bats` runs the tree with no `.codegraph/` directory and asserts the persisted `sources:` line carries `grep-fallback` | 7863710 |
| 08 | verified-real | verified-real — a fresh agent that never saw the implementation constructs breaking inputs against the shipped source; every hole it finds is fixed and pinned as a test in `bats tests/develop-context-pack.bats` | 61669a0 |
| 09 | integration | integration — a green GitHub Actions run on all 3 legs, its id recorded in `initiatives/develop/evidence/phase-05/ci-green.txt` | 777b49e |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
