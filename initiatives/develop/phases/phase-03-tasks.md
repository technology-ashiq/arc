# Build Brief — phase 03 · Controlled escalation: the build stops grinding on its own

spec-hash: sha256:36be2ceac22af35c8a0431dd2f57622abeb5729ed58c7d75c607ac7852e9ebd1
lane: develop
reqs: REQ-10
adrs: 0100, 0101, 0103, 0104, 0105
blast-radius: .claude/rules/security-sensitive.md, .claude/scripts/develop/stuck-counter.sh, .claude/state/develop/, docs/develop/debt-ledger.md, initiatives/<lane>/debt-ledger.md
no-gos: Delivery-order layers 3–5, Full Context Pack retrieval, Evaluation-suite seeding, Approach sketches with economics fields, Every checkpoint health check that needs to understand code, Dogfooding on real phases, Promoting any gate to BLOCK
blast-radius-dropped: 8

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

title: the 4 backstops fire on fixtures: fingerprint 3× · 5 attempts · risk-glob diff · unregistered marker
kind: logic
risk: high
proof: unit — bash tests/develop-stuck.bats, backstop firing tests
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: fingerprint-3x and attempts-5 both fire; risk globs and marker scan both report
commit: 1b2d9ab

#### slice: 02

title: each backstop has a negative control — a fixture where it must *not* fire
kind: logic
risk: medium
proof: unit — a negative control per backstop
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: none fires short of its trigger, and three DIFFERENT failures do not trip fingerprint-3x
commit: 1b2d9ab

#### slice: 03

title: `slice.stuck` receipts land on the spine
kind: logic
risk: medium
proof: unit — slice.stuck receipt assertions
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: receipt lands on a fired backstop, and none lands when no backstop fires
commit: 1b2d9ab

#### slice: 04

title: `checkpoint` runs inline from `next` and states plainly which trigger tripped
kind: logic
risk: medium
proof: unit — checkpoint invoked inline from next
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: runs at the slice boundary and names which trigger tripped
commit: 1b2d9ab

#### slice: 05

title: tests added & green on all 3 CI legs
kind: logic
risk: medium
proof: unit — all 3 CI legs
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: CI run 30754616004 green
commit: 1b2d9ab

#### slice: 06

title: `tree-manifest.txt` regenerated as a named step, and `ci.yml`'s test-count floor raised — this phase ships product files under time pressure, which is exactly where retro-log 2026-07-22's "surprise mid-task golden failure" lands
kind: infra
risk: medium
proof: static — tree-manifest regen + CI floor check
tier: static
sources: phase-03-spec.md
decision: (empty until proven)
result: delta diffed first; floor 318 already satisfied at 800+ tests
commit: 1b2d9ab

#### slice: 07

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: infra
risk: medium
proof: static — PROGRESS.md + board
tier: static
sources: phase-03-spec.md
decision: (empty until proven)
result: tracker updated, board-lint 0
commit: 1b2d9ab

### Prediction scores

likely-failure-mode: hit — the fingerprint normalisation was the delicate part exactly as predicted: too specific and the same failure never repeats, so the backstop never fires
likely-regression-site: hit — the stuck counters and their receipt path, as called
riskiest-file: hit — stuck.mjs held the judgement-sensitive logic, as predicted
expected-blockers: miss — predicted none, but slice.stuck was outside the closed spine vocabulary and needed ADR-0107; ADR-0106's own revisit trigger caught it
expected-proof-failures: hit — predicted a case or wording mismatch on a CI leg, and that is exactly what both failures were
