# Build Brief — phase 03 · Promotion safety

spec-hash: sha256:969f2fea0af8e03659cd742073fcfaed56de3d26739f57e725b39db6d82ae6fb
lane: evolve
reqs: 
adrs: 0300, 0305, 0310
blast-radius: (none)
no-gos: 
blast-radius-dropped: 4

### Non-negotiables

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never

### Predictions

likely-failure-mode: a hop that can only ever pass - a SHA check with no fixture proving it can refuse
likely-regression-site: lineage.mjs, at the seam between hops
riskiest-file: .claude/scripts/evolve/lineage.mjs
expected-blockers: none foreseen; the module is pure and has no production caller yet
expected-proof-failures: none - every hop was written with its negative control

### Slices

#### slice: 01

title: **Hop 1 → 2:** diff generated against the sealed `base_sha`; seal moved ⇒ proposal impossible; target must be on the `promote_via` allowlist — arbitrary paths refused; **two live experiments sealed against the same `base_sha` on the same target** is a fixture — whichever proposal reaches hop 3 second, after the first has merged, REFUSES on `candidate_sha` mismatch rather than landing against bytes the first already changed (REQ-03's concurrency cap is not scoped to distinct files)
kind: logic
risk: high
proof: contract - a clean seal returns a TICKET; a moved seal refuses with canonical-drift; a lying allowlist (Proxy, Array subclass, polluted Array.prototype.includes) cannot admit an off-list target
tier: contract
sources: phase-03-spec.md
decision: mayPropose returns a ticket carrying the seal and target it approved, and buildProposal REQUIRES it - the first version returned a bare ok:true, so nothing downstream could re-bind the decision and a proposal could be minted after hop 1 had refused
result: all negative controls fire. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 02

title: `promotion.proposed` carries `proposal_id` + `patch_sha` + `base_sha` + `candidate_sha` and the frozen evidence table (ADR-0310) into the inbox
kind: logic
risk: medium
proof: contract - the proposal id is recomputed from the payload and must match; a post-mint field edit breaks it
tier: contract
sources: phase-03-spec.md
decision: the id hashes the WHOLE payload including applies_to and restores - they were outside the preimage, so two reverts with completely different targets minted the SAME id and fields could be added after minting while the id still verified
result: two different reverts get different ids; a tampered payload fails verification. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 03

title: **Hop 3:** `experiment.promoted` emitted ONLY if the observed merged-file SHA == `candidate_sha`; mismatch → receipt REFUSED with the exact reason
kind: logic
risk: medium
proof: contract - an exact match passes, a mismatch refuses NAMING BOTH DIGESTS, and a hand-built or prototype-polluted object is not a proposal
tier: contract
sources: phase-03-spec.md
decision: every hop verifies the proposal id first, so hops 3 and 4 are attached to hops 1 and 2 - the first version checked each hop against itself, which is three independent self-consistency checks, not a chain
result: prototype pollution, hand-built objects and arrays all refused. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 04

title: **Hop 4:** the watch window runs ONLY while the current file SHA == `candidate_sha`, where "current" is read from wherever the target is actually SERVED — for any `promote_via` target with a deploy step, a working-tree match with no confirming deploy receipt does not start the watch (otherwise the watch passes while watching bytes nobody is running)
kind: logic
risk: medium
proof: contract - the watch refuses on drift, and a deploy-gated target refuses on a working-tree match with no confirming receipt, a receipt for another proposal, or a receipt for another target
tier: contract
sources: phase-03-spec.md
decision: requiresDeploy is REQUIRED and must be a literal boolean - it defaulted to false, and lineage.mjs has no production caller yet, so that fail-open default is exactly what the first caller would have silently inherited. A receipt must also name THIS proposal and THIS target: two files holding identical bytes is not hypothetical for stubs
result: 7 falsy/truthy-junk values for requiresDeploy all refuse. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 05

title: Post-promotion drift → `incident.raised` + surface FROZEN + **`manual intervention required`** carrying expected vs observed SHA and the archived champion reference — and **no machine revert patch is generated**
kind: logic
risk: medium
proof: contract - drift returns FROZEN, manual intervention required, both digests, the archived champion, and machine_generated_revert false
tier: contract
sources: phase-03-spec.md
decision: no revert is generated on unexplained drift: something else changed those bytes, this engine does not know what or why, and a machine-generated patch on top of an unexplained change turns one incident into two
result: asserted as DATA (machine_generated_revert: false) rather than by reading a message. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 06

title: Clean-case revert proposal binds `applies_to: candidate_sha` + `restores: champion base_sha`
kind: logic
risk: medium
proof: contract - a confirmed degradation proposes a revert binding applies_to to the promoted candidate and restores to the champion base
tier: contract
sources: phase-03-spec.md
decision: the revert is a PROPOSAL and merged_by_machine is false - ADR-0305 makes propose-only absolute in BOTH directions, so the urgent path and the happy path end at the same inbox
result: SHA-bound both ways. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 07

title: Degradation past threshold (own observation floor met) → incident + class demoted L1 + surface frozen + urgent SHA-bound revert diff to the inbox
kind: logic
risk: medium
proof: contract - only the literal true confirms; 7 truthy non-true values propose nothing; a missing revert patch freezes instead of minting
tier: contract
sources: phase-03-spec.md
decision: ownObservationMeetsFloor was a truthiness test, so the string 'false' - or 'unknown', or 'below floor' - coerced to CONFIRMED and minted a revert against a measurement the engine had just said it could not see. And the revert patch_sha must be REAL patch bytes: it was fabricated from three public identifiers, so it was reproducible without ever seeing a diff
result: both closed. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 08

title: **Canonical target byte-unchanged in every fixture**, forward and backward, until a human merge · healthy watch window → zero false positives · human-rejected proposal → champion intact
kind: logic
risk: medium
proof: contract - a frozen experiment and a frozen allowlist pass through every hop and every drift path unchanged
tier: contract
sources: phase-03-spec.md
decision: asserted with Object.freeze, so a mutation would throw in strict mode rather than being silently compared away
result: byte-identical before and after. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 09

title: **Negative control per hop:** each SHA check has a fixture proving it can FAIL, not only pass
kind: logic
risk: medium
proof: contract - each hop has a fixture proving it can FAIL, not only pass
tier: contract
sources: phase-03-spec.md
decision: this lane has twice shipped a gate that could not fail, so the negative control is the point rather than a nicety - and BREAK 11b is a negative control for the GUARD itself
result: every hop refuses when it should. CI run 30858666128 (19 jobs, 0 failures)
commit: 5834099

#### slice: 10

title: **Adversarial pass by a FRESH agent** on the lineage and watch path
kind: logic
risk: medium
proof: contract - a FOURTH fresh unanchored agent on the lineage and watch path
tier: contract
sources: phase-03-spec.md
decision: given canon.mjs as well as lineage.mjs, because the hash is what the chain's identity rests on - and that is where the worst finding was
result: 13 REAL BREAKS. Three land on things already claimed fixed: the propose-only GUARD was a grep that missed `from "fs"`, `child_process` and async exec/spawn, so a mutant that overwrote the canonical file and spawned a deploy passed it clean; canon.mjs's JSON.stringify folds NaN and -Infinity to null, so effect_floor -Infinity (the gate DISABLED) hashed identically to an unset floor; and read-once, documented as fixed in verdict.mjs, was never applied here, so an accessor walked hops 1, 3 and 4 with every premise false
commit: 5834099

#### slice: 11

title: tests added & green in CI · live demo run + output checked · tracker updated **Cut from this phase by ADR-0300:** "first real experiment OPENED on the chosen surface". No client, no surface, no traffic — recorded as banked, not delivered.
kind: logic
risk: medium
proof: contract - the full CI matrix
tier: contract
sources: phase-03-spec.md
decision: no local runs: CI is the only gate per the owner's standing instruction
result: CI run 30858666128 (19 jobs, 0 failures) green. Phase 03 passed CI first time on the initial build, and again after the 13 fixes
commit: 5834099

### Prediction scores

likely-failure-mode: miss -- 5834099. I predicted a hop that could only pass. Every hop DID have a negative control from the first commit. The real failure was subtler and worse: the hops each passed their own control while not being attached to each other, so the chain was three independent self-consistency checks
likely-regression-site: hit -- 5834099. lineage.mjs, at the seam between hops, exactly as predicted - and that is where 8 of the 13 breaks were
riskiest-file: miss -- 5834099. lineage.mjs took most of the breaks, but the WORST one was in tests/evolve-lineage.bats: the guard for the lane's single most important rule was a grep a mutant walked straight past. The riskiest file was the one asserting the risk was handled
expected-blockers: hit -- none appeared
expected-proof-failures: unforeseen -- 5834099. Phase 03 passed CI first time, which I read as a good sign. It was not: CI proves my tests pass, and my tests had a hole in exactly the assertion that mattered most

### Debt ledger

- **what:** `lineage.mjs` has no production caller. It is a pure decision layer with no runner wired to it.
  **where:** `.claude/scripts/evolve/lineage.mjs`.
  **why accepted:** the phase's acceptance is fixture-proven by ADR-0300 - there is no client, no surface and no traffic, so a runner would have nothing to run.
  **cost of leaving it:** every default in the module is a default the first caller inherits without choosing it. That is not hypothetical: `requiresDeploy` defaulted to false and would have opened the deploy gate for whoever wired it first.
  **pay-down trigger:** the first real caller - and audit every default at that moment rather than after.

