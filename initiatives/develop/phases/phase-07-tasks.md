# Build Brief — phase 07 · Quality intelligence: prior art on decisions, alternatives on risky slices

spec-hash: sha256:6fba1d25015eaf38a394f6dddd31b785560658a4d96852d413903611f9267f8d
lane: develop
reqs: REQ-09, REQ-10
adrs: 
blast-radius: .claude/agents/pattern-miner.md
no-gos: A graph database or any new memory store, Automated promotion, Autonomous capability installation, Ambient research, Cross-platform dependency-version replay matrices, Rebuilding anything Cycle 5 shipped
blast-radius-dropped: 2

### Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: `pattern-miner` runs only on a declared decision; a slice without one gets no annex and no agent is spawned — asserted, not assumed
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: a Pattern Annex row missing a source or a verdict is lint-invalid, named by row
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: the annex is capped at 20 lines and the cap is enforced, not requested
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: a risk-glob slice without 2–3 sketches WARNs; a non-risk slice is untouched
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: a sketch carrying an invented duration is lint-rejected; a sketch with computed counts passes
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: the pick is recorded with `rejected-because` for each losing option
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: every new check has a negative control proving it can fail
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-07-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
