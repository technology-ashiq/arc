# Build Brief — phase 04 · Council bridge (THE DESIGNATED CUT)

spec-hash: sha256:184b75991444bd3d20248c427c00131918b1f40d86438cb685b64b4b6df546e0
lane: evolve
reqs: 
adrs: 0307, 0310
blast-radius: (none)
no-gos: 
blast-radius-dropped: 3

### Non-negotiables

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never

### Predictions

likely-failure-mode: a calibration number computed from too few sessions, or an unresolved outcome scored as a miss
likely-regression-site: validate.mjs, since the kind list is changing again
riskiest-file: .claude/scripts/evolve/calibrate.mjs
expected-blockers: council requires only core, so re-pointing it at the reader crosses a product boundary
expected-proof-failures: a stale hardcoded kind count somewhere

### Slices

#### slice: 01

title: Council verdict/outcome lifecycle emits typed receipts — `council.verdict` already exists in `KINDS`; `council.outcome` is added per ADR-0310
kind: logic
risk: high
proof: contract - council.outcome emits and lands; both council payloads are CLOSED against unknown keys, case-varied enums, a bad session id, a bad date and a URL-shaped source_id
tier: contract
sources: phase-04-spec.md
decision: council.verdict is closed too, not only the new kind. It existed with 0 emitted, so closing it now breaks nothing and matches ADR-0304's rule: if the score reads a field, a validator asserts it
result: 8 malformed payloads refused; the vocabulary grew by exactly one. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 02

title: `council-calibrate` re-pointed from Markdown session files to the reader
kind: logic
risk: medium
proof: contract - `council-calibrate --from-spine` scores from receipts through the reader
tier: contract
sources: phase-04-spec.md
decision: the spine imports are LAZY, inside the --from-spine branch. A load-time import would break the Markdown path in any consumer repo that installed `council` without `hq` - which is precisely how the design suite broke in Phase 01
result: spine mode reads through spine.mjs; the Markdown path is untouched. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 03

title: **No v1 backfill** of historical Markdown sessions — only receipts emitted from wiring-time forward count
kind: logic
risk: medium
proof: contract - the REAL spine is asserted to carry ZERO scored council sessions, and the calibration reads insufficient evidence
tier: contract
sources: phase-04-spec.md
decision: no backfill (ADR-0307). Backfilling the historical Markdown sessions would invent calibration from sessions that were never scored, so the honest reading today is the test
result: 0 scored, verdict = insufficient evidence. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 04

title: Juror hit-rates, confidence buckets and Brier score render on the board
kind: logic
risk: medium
proof: contract - bucket hit-rates and a Brier score render, with an empty bucket showing MISSING rather than 0 percent
tier: contract
sources: phase-04-spec.md
decision: a hit-rate over zero sessions is not 0% - there is nothing to rate. Same rule as the board's MISSING windows
result: empty buckets render MISSING. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 05

title: A proposed juror-weight change arrives as a diff + inbox item, human-approved — never applied
kind: logic
risk: medium
proof: contract - a juror-weight change is proposed with its evidence and applied:false, and nothing is proposed on a calibration below floor
tier: contract
sources: phase-04-spec.md
decision: proposing a weight change on a calibration that does not exist would be acting on noise with the authority of a number
result: proposed, never applied; silent below floor. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 06

title: Terminal outcomes below floor → `insufficient evidence`, never invented calibration
kind: logic
risk: medium
proof: contract - below floor the verdict is `insufficient evidence` and the Brier score is null, and the RENDER carries no number
tier: contract
sources: phase-04-spec.md
decision: the render is asserted too, not just the returned object - three scored sessions produce a Brier score to four decimal places and it means nothing, so the number must not reach a screen
result: no digits after 'brier' below floor. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 07

title: Fixture on synthetic sessions proves the calibration math
kind: logic
risk: medium
proof: contract - hand-checkable arithmetic: 10 hits and 10 misses at High gives Brier ((0.85-1)^2*10 + (0.85-0)^2*10)/20, and an unresolved outcome is EXCLUDED not scored 0
tier: contract
sources: phase-04-spec.md
decision: a correct HOLD counts as a hit. Scoring 'happened == hit' for every call would mark every correct hold as wrong, so a council that rightly said do-not-do-this would look badly calibrated for being right
result: arithmetic matches to 1e-12; 25 scored and 10 excluded from 35 sessions. CI run 30857942064, re-verified in 30858666128
commit: ea20ec1

#### slice: 08

title: tests added & green in CI · live demo run + output checked · tracker updated
kind: logic
risk: medium
proof: contract - the full CI matrix
tier: contract
sources: phase-04-spec.md
decision: no local runs: CI is the only gate
result: CI run 30857942064, re-verified in 30858666128 green
commit: ea20ec1

### Prediction scores

likely-failure-mode: hit -- ea20ec1. Both halves were built as the two load-bearing tests precisely because they were predicted: an unresolved outcome is excluded and reported, and below floor renders insufficient evidence with no number reaching the screen
likely-regression-site: hit -- ea20ec1. validate.mjs, and the regression was real: my own Phase-00 test asserted "closed 30" and went stale the moment this kind landed
riskiest-file: miss -- ea20ec1. calibrate.mjs was clean. The break was in tests/evolve-receipts.bats, a file written three phases earlier
expected-blockers: hit -- ea20ec1. council requires only core, so the spine import had to be made LAZY rather than load-time - the same lesson the design sandbox taught in Phase 01
expected-proof-failures: hit -- ea20ec1. ADR-0309 predicted this drift by name ("anything that hardcodes 22 will drift"), and it was a literal 30 in my own test. Both vocabulary tests now read the count from KINDS

### Debt ledger

- **what:** `council-calibrate` still defaults to the Markdown path; spine mode is opt-in behind `--from-spine`.
  **where:** `.claude/scripts/council/council-calibrate.mjs`.
  **why accepted:** there are ZERO council receipts on the spine, so making spine mode the default would replace a working report with `insufficient evidence` for every existing user, and `council-lint` shares the Markdown corpus.
  **cost of leaving it:** two scoring paths exist, and the Markdown one can drift from the receipt one.
  **pay-down trigger:** the first council session that emits a `council.verdict` receipt - flip the default then and delete the Markdown path when the corpus is fully receipted.

