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

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: **Hop 1 → 2:** diff generated against the sealed `base_sha`; seal moved ⇒ proposal impossible; target must be on the `promote_via` allowlist — arbitrary paths refused; **two live experiments sealed against the same `base_sha` on the same target** is a fixture — whichever proposal reaches hop 3 second, after the first has merged, REFUSES on `candidate_sha` mismatch rather than landing against bytes the first already changed (REQ-03's concurrency cap is not scoped to distinct files)
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `promotion.proposed` carries `proposal_id` + `patch_sha` + `base_sha` + `candidate_sha` and the frozen evidence table (ADR-0310) into the inbox
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: **Hop 3:** `experiment.promoted` emitted ONLY if the observed merged-file SHA == `candidate_sha`; mismatch → receipt REFUSED with the exact reason
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **Hop 4:** the watch window runs ONLY while the current file SHA == `candidate_sha`, where "current" is read from wherever the target is actually SERVED — for any `promote_via` target with a deploy step, a working-tree match with no confirming deploy receipt does not start the watch (otherwise the watch passes while watching bytes nobody is running)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Post-promotion drift → `incident.raised` + surface FROZEN + **`manual intervention required`** carrying expected vs observed SHA and the archived champion reference — and **no machine revert patch is generated**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: Clean-case revert proposal binds `applies_to: candidate_sha` + `restores: champion base_sha`
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Degradation past threshold (own observation floor met) → incident + class demoted L1 + surface frozen + urgent SHA-bound revert diff to the inbox
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Canonical target byte-unchanged in every fixture**, forward and backward, until a human merge · healthy watch window → zero false positives · human-rejected proposal → champion intact
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **Negative control per hop:** each SHA check has a fixture proving it can FAIL, not only pass
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: **Adversarial pass by a FRESH agent** on the lineage and watch path
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: tests added & green in CI · live demo run + output checked · tracker updated **Cut from this phase by ADR-0300:** "first real experiment OPENED on the chosen surface". No client, no surface, no traffic — recorded as banked, not delivered.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
