# Phase 12 -- CI results

CI run 38549208594 at `fb808a70` (the PR #423 head, squash-merged unchanged as `1fedd504`): **19/19 jobs green, read per job**
with `ci-digest`. Ubuntu 22 leg: reconcile declared 4671, executed 4671. The suite `tests/engine-spend.bats` asserts its
exact check count per section (unit 45, run 26, cc 11, cap 19) and zero FAIL lines; every section passed on every leg.
The run before it (38529938986 at `1ca2e495`) was also 19/19; the first (38489875382) was red and is recorded in the
done-log with its three causes.

Phase 12 checks (section cc + unit's capture/mutant/grep checks): SessionSpend against VERBATIM captures of claude CLI
2.1.296 (json envelope total_cost_usd 0.0175131, stream result 0.01478745 -- A-11 held); json and stream paths through the
fake CLI; absent / string / negative figures not-reported with nothing booked; a non-JSON answer and a CLI that fails
after its session still book their spend (json and stream); the float mutant turns 0.07 and 0.14 red; no second reader
of a provider figure in 126 files.

Attack: 3e5fc9e -- logic 9, boundary 5; B2/B3/B5 fixed in 2f050f5e, 10 rejected with the six-word taxonomy (PROGRESS).
