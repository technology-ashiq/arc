# Phase 13 -- CI results

CI run 38549208594 at `fb808a70` (the PR #423 head, squash-merged unchanged as `1fedd504`): **19/19 jobs green, read per job**
with `ci-digest`. Ubuntu 22 leg: reconcile declared 4671, executed 4671. The suite `tests/engine-spend.bats` asserts its
exact check count per section (unit 45, run 26, cc 11, cap 19) and zero FAIL lines; every section passed on every leg.
The run before it (38529938986 at `1ca2e495`) was also 19/19; the first (38489875382) was red and is recorded in the
done-log with its three causes.

Phase 13 checks (section cap + migrated suites): claude-code and generic-api meter; a numeric cap needs its currency;
a currency on an unmetered row and a cap on an unmetered chain are load faults; MAX_COST_REACHED with spent 1 for
0.004+0.004 (the receipt's one rounding); MAX_COST_UNPROVEN for another currency, an answered-and-unreported attempt and
an explicit spend null; the real router loads clean with 11 metered rows + default on USD caps and hermes unmetered;
through the real arc-run: a reached cap refuses the schema retry (hits 1, control 2) and the claude-code cross-family hop
(hits 0, control 1), refusal.spent equals the run's cost.incurred amount, a streamed unreported run is UNPROVEN.
The face kernel and factory rings (propose driver / retire) pass with followMoneyTerm.

Attack: 2f050f5 -- logic 11, boundary 3; B2/B3 fixed in 6e3b4e6a, 12 rejected (PROGRESS). CI round 1 then found the
propose.mjs coupling and the drivers/ BYPASS gate, fixed in da151269.
