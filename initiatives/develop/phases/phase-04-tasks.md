# Build Brief — phase 04 · The Learning System: a record that compounds, and a promotion no machine can complete

spec-hash: sha256:4a9cc69cc8b7e6dfb12ceb516b5528f4aa0fa345180eb2b46cf141decdd9daa5
lane: develop
reqs: REQ-01, REQ-02, REQ-03
adrs: 0053, 0108, 0109
blast-radius: .claude/scripts/develop/develop.mjs, .claude/scripts/develop/learning.mjs, docs/develop/learning-ledger.md, initiatives/develop/evidence/phase-04/candidate-<id>-eval.md, tests/fixtures/develop-evals/, tests/fixtures/develop-evals/<category>/<id>.md
no-gos: A graph database or any new memory store, Automated promotion, Autonomous capability installation, Ambient research, Cross-platform dependency-version replay matrices, Rebuilding anything Cycle 5 shipped
blast-radius-dropped: 4

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

title: `docs/develop/learning-ledger.md` exists with ≥3 real rows drawn from Cycle 5's actual findings, each carrying typed links
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `develop-lint` FAILs an unparseable learning row and names its id and line
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: `develop-lint` WARNs a row with zero typed links
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `develop-lint` FAILs a `verdict: promoted` row missing `replay:`, `evaluated-by:` or `approved-by:` — asserted once per missing field, not once in total
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: `tests/fixtures/develop-evals/` holds ≥12 fixtures across SIX categories — spec-drift, false-confidence, missing-edge-case, bad-gate, flailing, and **`clean/` (≥4 of them)**. Without clean controls a candidate that flags everything scores a perfect catch-count and a false-block count of zero, which is the same shape as a gate that cannot fail
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: `withheld/` exists, a candidate citing a withheld id FAILs, and no command prints its contents
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: replay computes catch-count (flagged among `expect: flagged`) AND false-block count (flagged among `expect: clean`), and the lint rejects a self-declared number in any learning row
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **one REAL promotion runs end to end** — a genuine Cycle-5 finding ("verify a receipt actually landed rather than trusting exit 0") goes candidate -> replay -> fresh-agent verdict -> Ashiq approval, and ships as an enforced check **inside `.claude/scripts/develop/develop.mjs` (the receipt-emitting path) — a Cycle-5 file, named here because editing shipped code is exactly the self-modification the non-negotiables require a recorded promotion for, and "What this phase actually builds" lists only new files**. A loop proven only on demonstration candidates is proven on nothing, which is the self-graded evidence ADR-0108 exists to refuse. **This is the phase's only step needing Ashiq in real time: if the tripwire fires before that review lands, the promotion carries forward as Phase 05's first slice — never a stub approval**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: every new check has a negative control proving it can fail
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: the adversarial pass on this lint is run by a **fresh agent that has not seen the code**, and every hole is pinned as a fixture
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: tests green on all 3 CI legs
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: `tree-manifest.txt` regenerated as a named step
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
