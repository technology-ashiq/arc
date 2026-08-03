# Handoff pack — phase 03 · lane evolve

11/11 slices proven.

## Prediction calibration

2 hit · 2 miss · 1 unforeseen

- **likely-failure-mode** — miss -- 5834099. I predicted a hop that could only pass. Every hop DID have a negative control from the first commit. The real failure was subtler and worse: the hops each passed their own control while not being attached to each other, so the chain was three independent self-consistency checks
- **likely-regression-site** — hit -- 5834099. lineage.mjs, at the seam between hops, exactly as predicted - and that is where 8 of the 13 breaks were
- **riskiest-file** — miss -- 5834099. lineage.mjs took most of the breaks, but the WORST one was in tests/evolve-lineage.bats: the guard for the lane's single most important rule was a grep a mutant walked straight past. The riskiest file was the one asserting the risk was handled
- **expected-blockers** — hit -- none appeared
- **expected-proof-failures** — unforeseen -- 5834099. Phase 03 passed CI first time, which I read as a good sign. It was not: CI proves my tests pass, and my tests had a hole in exactly the assertion that mattered most

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - a clean seal returns a TICKET; a moved seal refuses with canonical-drift; a lying allowlist (Proxy, Array subclass, polluted Array.prototype.includes) cannot admit an off-list target | 5834099 |
| 02 | contract | contract - the proposal id is recomputed from the payload and must match; a post-mint field edit breaks it | 5834099 |
| 03 | contract | contract - an exact match passes, a mismatch refuses NAMING BOTH DIGESTS, and a hand-built or prototype-polluted object is not a proposal | 5834099 |
| 04 | contract | contract - the watch refuses on drift, and a deploy-gated target refuses on a working-tree match with no confirming receipt, a receipt for another proposal, or a receipt for another target | 5834099 |
| 05 | contract | contract - drift returns FROZEN, manual intervention required, both digests, the archived champion, and machine_generated_revert false | 5834099 |
| 06 | contract | contract - a confirmed degradation proposes a revert binding applies_to to the promoted candidate and restores to the champion base | 5834099 |
| 07 | contract | contract - only the literal true confirms; 7 truthy non-true values propose nothing; a missing revert patch freezes instead of minting | 5834099 |
| 08 | contract | contract - a frozen experiment and a frozen allowlist pass through every hop and every drift path unchanged | 5834099 |
| 09 | contract | contract - each hop has a fixture proving it can FAIL, not only pass | 5834099 |
| 10 | contract | contract - a FOURTH fresh unanchored agent on the lineage and watch path | 5834099 |
| 11 | contract | contract - the full CI matrix | 5834099 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
