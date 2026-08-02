# Build Brief — phase 02 · Earned judgment: predictions scored, fidelity checked by someone with no stake

spec-hash: sha256:3bb65f3ac42062963d1dcb4b46a8b9e025964de72dbd12bc46fcb3abc7fc2049
lane: develop
reqs: REQ-08, REQ-09
adrs: 0100, 0101, 0104, 0105
blast-radius: .claude/agents/spec-fidelity.md, PLAN.md
no-gos: Delivery-order layers 3–5, Full Context Pack retrieval, Evaluation-suite seeding, Approach sketches with economics fields, Every checkpoint health check that needs to understand code, Dogfooding on real phases, Promoting any gate to BLOCK
blast-radius-dropped: 4

### Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0100).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0101).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0104).

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: the harness was run against this phase's own real spec before the phase was built, and what it produced (usable brief, or the specific way it failed) is recorded in the ledger
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `handoff` scores all 5 prediction fields with a settling ledger reference each
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: no numeric confidence appears anywhere in the output — `develop-lint`'s `self-declared-number` group is asserted against the handoff output itself
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `spec-fidelity` runs with spec + diff only and its report lands in the evidence pack
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: a deliberately drifted fixture (a slice implementing something the spec never asked for) is caught by the fidelity pass
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: tests added & green on all 3 CI legs
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
