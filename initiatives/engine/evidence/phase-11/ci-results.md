# Phase 11 -- CI results

CI run 38549208594 at `fb808a70` (the PR #423 head, squash-merged unchanged as `1fedd504`): **19/19 jobs green, read per job**
with `ci-digest`. Ubuntu 22 leg: reconcile declared 4671, executed 4671. The suite `tests/engine-spend.bats` asserts its
exact check count per section (unit 45, run 26, cc 11, cap 19) and zero FAIL lines; every section passed on every leg.
The run before it (38529938986 at `1ca2e495`) was also 19/19; the first (38489875382) was red and is recorded in the
done-log with its three causes.

Phase 11 checks (section unit + run): spendOf corpus incl. the float trap rows, sumSpend's one rounding, isSpend, basis,
unbookedRuns; through the real arc-run: one cost.incurred per metered run, landed, run_ref; not-reported vs
driver-unmetered absences with zero money rows; a string figure refused; 0.004+0.004 = 1 cent on the receipt AND the
money row; two identical runs book two rows; a re-emit is DUP_IDEM; two currencies never added; spend.mjs folds the
engine row as nothing (A-13 held); costs.mjs shows the USD line.

Attack: round 1 at e2dc399 -- logic 0, boundary 4 (B1 high, B2 medium, B3/B4 low), all four fixed in 3e5fc9ef.
