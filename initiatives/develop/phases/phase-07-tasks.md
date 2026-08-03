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
proof: contract - `bats tests/develop-quality.bats` asserts both directions: a slice declaring a decision owes an annex, and a slice declaring none is FAILED for carrying one
tier: contract
sources: phase-07-spec.md
decision: the trigger is a `decision-type:` field from a closed vocabulary, so 'a declared decision' is a fact about the ledger and not a judgement
result: both directions asserted, plus a section naming a slice that does not exist
commit: c1518f0

#### slice: 02

title: a Pattern Annex row missing a source or a verdict is lint-invalid, named by row
kind: logic
risk: medium
proof: contract - `bats tests/develop-quality.bats` over a row with no source and a row whose verdict is `interesting`
tier: contract
sources: phase-07-spec.md
decision: verdicts are prefix-matched (`adopted - reason`), and the row is named in the message
result: both FAIL and name the row; the header row is whichever precedes the separator, not one literally called `pattern`
commit: c1518f0

#### slice: 03

title: the annex is capped at 20 lines and the cap is enforced, not requested
kind: logic
risk: medium
proof: contract - `bats tests/develop-quality.bats` over a 24-row annex, and over the same annex split under two headings
tier: contract
sources: phase-07-spec.md
decision: the cap counts non-blank body lines, and a second section for one slice is an ERROR rather than last-wins
result: the split-annex evasion a fresh agent found is closed and pinned
commit: f044b18

#### slice: 04

title: a risk-glob slice without 2–3 sketches WARNs; a non-risk slice is untouched
kind: logic
risk: medium
proof: contract - `bats tests/develop-quality.bats` asserts a risk-glob slice WARNs and a non-risk slice is silent
tier: contract
sources: phase-07-spec.md
decision: risk is path-matched from the slice's own title, backticked or not; never from its self-declared `risk:` field
result: both directions asserted; the WARN fired on a real slice in phase-01 the first time it ran
commit: f044b18

#### slice: 05

title: a sketch carrying an invented duration is lint-rejected; a sketch with computed counts passes
kind: logic
risk: medium
proof: contract - `bats tests/develop-quality.bats` over `~6 months`, and over `touches 3 call sites` / `deps +0, services +1, config +2`
tier: contract
sources: phase-07-spec.md
decision: the ban applies to the ECONOMICS fields only - it fired on `a 30 day session TTL`, a measured fact, on the auth slices where token lifetimes are the design
result: the duration is caught in words and abbreviations and across two fields; computed counts pass
commit: f044b18

#### slice: 06

title: the pick is recorded with `rejected-because` for each losing option
kind: logic
risk: medium
proof: contract - `bats tests/develop-quality.bats` over a rejected approach with no `rejected-because`, and over zero and two picked
tier: contract
sources: phase-07-spec.md
decision: exactly one picked, prefix-matched so `picked - one place beats fourteen` is a verdict and not an error
result: asserted; the string-equality version rejected a verdict carrying its reason while the annex accepted one
commit: f044b18

#### slice: 07

title: every new check has a negative control proving it can fail
kind: logic
risk: medium
proof: contract - every check in `bats tests/develop-quality.bats` is asserted to FIRE on its case and STAY SILENT on the other
tier: contract
sources: phase-07-spec.md
decision: the silence half is the control: a check that fires on everything satisfies every positive test and is process tax
result: 23 tests, each check paired
commit: c1518f0

#### slice: 08

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: medium
proof: verified-real - a fresh agent that never saw the code found 21 holes, including a design error that made the feature unusable
tier: verified-real
sources: phase-07-spec.md
decision: sketches and annexes moved to `phase-NN-quality.md`; teaching the hardened Phase-00 parser two new section types was the alternative and it is pinned by 45 fixtures
result: all fixed and pinned; the headline was that ANY ledger carrying two sketches was BLOCKed by seven `brief repeats key` errors
commit: f044b18

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: logic
risk: medium
proof: integration - CI run 30775054470 green on all 3 legs at head 34ef15d
tier: integration
sources: phase-07-spec.md
decision: green on three legs before close, never on one
result: tree-manifest regenerated; manifest.json lists quality.mjs and pattern-miner.md
commit: 34ef15d

### Prediction scores

likely-failure-mode: miss - the checks did not fire too widely, they could not fire at all. Any ledger carrying two approach sketches was BLOCKed by seven `brief repeats key` errors, because approach fields collided with the brief namespace. The feature was unusable and no test exercised it end to end
likely-regression-site: hit - every structural hole was in the section finders. Fences were live structure, duplicate sections were last-wins, a section naming an unknown slice was never validated, and an annex between slices swallowed every slice after it
riskiest-file: hit - all 21 findings were in quality.mjs; no other file had any
expected-blockers: hit — and the second half was the harder one. `a 30 day session TTL` and `adds 2 minutes to every CI run, measured` were flagged as invented costs on auth slices, where token lifetimes ARE the design. The ban applies to the economics fields only now
expected-proof-failures: hit - it failed in BOTH directions at once, missing `half a year`, `6mo`, `a couple of sprints` and `6 person-months` while flagging measured facts, and it was a denial of service besides (16.8s on 3000 spaces, scaling cubically)
