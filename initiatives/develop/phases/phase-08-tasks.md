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
proof: contract - `bats tests/develop-metrics.bats` asserts each of the six against a number derived by hand from a fixture built to produce it
tier: contract
sources: phase-08-spec.md
decision: the fixture's records are readable: 2 fidelity reports (1 drifted), 2 stuck receipts, 10:00->11:30 and 14:00->14:30, 4 trial rows (1 false positive), 4 ticked slices (3 complete)
result: all six match: 1, 2, 60, 0.25, 0.75, 1
commit: a52a4b2

#### slice: 02

title: a metric that cannot be derived prints `not derivable` **with its reason** — asserted by a fixture missing the records it needs; it must never print a figure there
kind: logic
risk: medium
proof: contract - `bats tests/develop-metrics.bats` over a fixture holding none of the records, asserting a null value AND a non-empty reason for every metric
tier: contract
sources: phase-08-spec.md
decision: a reason is part of the shape, not an extra: `absent(name, reason)` cannot be constructed without one
result: all six say why; a second test greps the JSON for any numeric value and requires zero
commit: a52a4b2

#### slice: 03

title: the calibration record aggregates every scored prediction across every phase in the fixture, and its totals match a hand count
kind: logic
risk: medium
proof: contract - `bats tests/develop-metrics.bats` asserts the totals AND the per-field breakdown against a hand count
tier: contract
sources: phase-08-spec.md
decision: the record is derived and stores nothing, so it cannot drift from what it describes; a test asserts the file count is unchanged after a run
result: 2 hit, 2 miss, 1 unforeseen, 5 total; byField carries the fields, not a single score
commit: a52a4b2

#### slice: 04

title: `develop-lint` FAILs a `tag:` outside the closed vocabulary and passes each of the five
kind: logic
risk: medium
proof: contract - `bats tests/develop-metrics.bats` asserts a free-text tag FAILs and each of the five passes
tier: contract
sources: phase-08-spec.md
decision: the vocabulary was already closed in Phase 04; what was missing was anything asserting it
result: the FAIL test found that develop-lint's early exit was skipping the learning ledger entirely
commit: c25e5c1

#### slice: 05

title: Phase 05's Context Pack matches learning rows on `tag:` as well as `area:` — asserted
kind: logic
risk: medium
proof: contract - `bats tests/develop-metrics.bats` asserts a tagged row IS retrieved by its tag and a differently-tagged row is NOT
tier: contract
sources: phase-08-spec.md
decision: tag joins area and blast-radius overlap as a third matcher, not a replacement
result: both directions asserted, because `matches on tag` is satisfied by a matcher that returns everything
commit: a52a4b2

#### slice: 06

title: a suggestion carries evidence, economics and a default; one with an invented duration is lint-rejected; one raised mid-slice rather than at a boundary is rejected
kind: logic
risk: medium
proof: contract - `bats tests/develop-metrics.bats` over a complete suggestion, one with no default, one with no evidence, one priced in time, and one raised mid-slice
tier: contract
sources: phase-08-spec.md
decision: a section that is not at a slice boundary is REFUSED rather than accepted with a note - the batching rule is the feature
result: all five asserted; the boundary heading must name a slice and end at its boundary, because the word appearing anywhere passed
commit: c25e5c1

#### slice: 07

title: every new check has a negative control proving it can fail
kind: logic
risk: medium
proof: contract - every check has its negative control in `bats tests/develop-metrics.bats`: the metric that computes and the one that refuses, the tag that passes and the one that fails, the retrieval that fires and the one that stays silent
tier: contract
sources: phase-08-spec.md
decision: a deriver returning a figure for everything passes every positive test; one refusing everything passes every negative one
result: 43 tests, each check paired
commit: 27cb7ce

#### slice: 08

title: **the adversarial pass on this phase's lint additions is run by a fresh agent that has not seen the code, in the same commit that ships them** — not at phase close, which is where it got skipped on three gates in one phase on 2026-08-02
kind: logic
risk: medium
proof: verified-real - a fresh agent that never saw the code found 20 holes, 13 of them wrong numbers reported as real, and one live on this repo
tier: verified-real
sources: phase-08-spec.md
decision: the pass ran against the working tree before the lint additions were final, so its findings ship in the same commits as the code they are about
result: all fixed and pinned; the live one was `false-block-rate` printing 0 while five trial rows read `unadjudicated`
commit: c25e5c1

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · `products/develop/manifest.json` updated if any file is added · tracker updated
kind: logic
risk: medium
proof: integration - CI run 30782174344 green on all 3 legs at head 27cb7ce
tier: integration
sources: phase-08-spec.md
decision: green on three legs before close, never on one
result: tree-manifest regenerated; manifest.json lists metrics.mjs
commit: 27cb7ce

### Prediction scores

likely-failure-mode: hit — and it was live. `false-block-rate` printed 0 on this repo while the trial ledger held five rows reading `unadjudicated`, `unadjudicated, leaning false` and `n/a — not counted as a clean run`. They went into the denominator and a perfect gate record came out
likely-regression-site: hit — all 20 findings were in the readers. Fences, column positions, prose matched as verdicts, file order mistaken for time order, and a lane field ignored entirely
riskiest-file: hit — metrics.mjs took every finding; develop-lint took two of its own and no other file had any
expected-blockers: miss — `not derivable` was the easy half, because the shape makes a reason mandatory. The hard half was the opposite: deciding when a number that COULD be computed should not be, which is what the unadjudicated rows and the 90-day ceiling are
expected-proof-failures: unforeseen — the fixture's numbers were right first time. What failed twice was my own FIX: a median of two values is the mean, and `` sits inside `hit-and-miss` right where the hedge splits
