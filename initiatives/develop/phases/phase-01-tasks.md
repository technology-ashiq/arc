# Build Brief — phase 01 · The proof floor: a gate that can fail, and a parser that survives attack

spec-hash: sha256:2aa841903553b16601f59ac9e970dac0e3ea72004bf5b7779763e934e8712bf4
lane: develop
reqs: REQ-05, REQ-06, REQ-07
adrs: 0100, 0101, 0104, 0105
blast-radius: .claude/scripts/develop/develop-lint.mjs, .github/workflows/ci.yml, docs/trial-ledger.md, tests/fixtures/develop/breaking/, tests/fixtures/develop/negative-control/
no-gos: Delivery-order layers 3–5, Full Context Pack retrieval, Evaluation-suite seeding, Approach sketches with economics fields, Every checkpoint health check that needs to understand code, Dogfooding on real phases, Promoting any gate to BLOCK
blast-radius-dropped: 9

### Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0100).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0101).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0104).

### Predictions

likely-failure-mode: the ledger parser accepts a doctored artifact that only looks legitimate — the cosmetic-variant class from retro-log 2026-07-16
likely-regression-site: ledger.mjs parseLedger, where tolerant detection and strict grammar meet
riskiest-file: .claude/scripts/develop/develop-lint.mjs
expected-blockers: none known; the adversarial pass is expected to find holes rather than blockers
expected-proof-failures: CRLF and duplicate-slice-id fixtures failing on the Windows leg only

### Slices

#### slice: 01

title: `node .claude/scripts/develop/develop-lint.mjs --lane develop` exits 1 on each of the three BLOCK mutations and exits 0 on the good fixture
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: each BLOCK has a **negative-control fixture** that proves the check can fail — a control that has never been seen to fail is a coin, not a gate (retro-log 2026-08-02)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: ≥20 breaking inputs pinned under `tests/fixtures/develop/breaking/`, each FAILing the lint, with the good fixture still passing
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: every proof carries a tier from `static|unit|contract|integration|e2e-visual|verified-real` and its slice a `kind:`; the fake-phase fixture carries one `ui` slice and one `external-dep` slice so both tier floors are actually exercised, plus one slice with no `kind:` to prove the missing-classification WARN fires instead of a silent skip
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: WARN groups registered in `docs/trial-ledger.md` with their promotion criteria
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: tests added & green: `bash tests/develop-lint.bats` on all 3 CI legs
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: `.github/workflows/ci.yml`'s test-count floor raised to cover the new `@test` lines
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: `tree-manifest.txt` regenerated as a named step
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
