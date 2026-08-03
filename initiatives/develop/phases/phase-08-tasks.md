# Build Brief — phase 08 · The feedback half: does the harness actually make things better?

spec-hash: sha256:46fe5d74c2b50b2d0410d2cf3e60cd47d47c5b03ed68f4de9fd8faa4aef0ab99
lane: develop
reqs: REQ-10
adrs: 
blast-radius: products/develop/manifest.json
no-gos: A graph database or any new memory store, Automated promotion, Autonomous capability installation, Ambient research, Cross-platform dependency-version replay matrices, Rebuilding anything Cycle 5 shipped
blast-radius-dropped: 5

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

title: all 6 metrics compute from committed records on a fixture repo with known values, and each asserted against a hand-derived expected number
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: a metric that cannot be derived prints `not derivable` **with its reason** — asserted by a fixture missing the records it needs; it must never print a figure there
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: the calibration record aggregates every scored prediction across every phase in the fixture, and its totals match a hand count
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `develop-lint` FAILs a `tag:` outside the closed vocabulary and passes each of the five
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Phase 05's Context Pack matches learning rows on `tag:` as well as `area:` — asserted
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: a suggestion carries evidence, economics and a default; one with an invented duration is lint-rejected; one raised mid-slice rather than at a boundary is rejected
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: every new check has a negative control proving it can fail
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **the adversarial pass on this phase's lint additions is run by a fresh agent that has not seen the code, in the same commit that ships them** — not at phase close, which is where it got skipped on three gates in one phase on 2026-08-02
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · `products/develop/manifest.json` updated if any file is added · tracker updated
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-08-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
