# Build Brief — phase 00 · lint fixture

spec-hash: sha256:c1a8dabe624f890b3bb46f212d7e10ee63c826092718b7d09215435031630230
lane: develop
reqs: REQ-01
adrs: 0100, 0101
blast-radius: (none)
no-gos: Nothing

### Non-negotiables

- Every slice declares its acceptance proof BEFORE implementation.

### Predictions

likely-failure-mode: the parser accepts a doctored artifact that only looks legitimate
likely-regression-site: parseLedger tolerant detection
riskiest-file: develop-lint.mjs
expected-blockers: none
expected-proof-failures: none

### Slices

**slice: 01**

title: a proven slice, complete in every field
kind: logic
risk: high
proof: unit — `bash tests/develop-lint.bats`
tier: (empty until proven)
sources: phase-00-spec.md
decision: —
result: 4 tests, 4 passing
commit: 8c46844

#### slice: 02

title: an unproven slice, which is legal and must not trip anything
kind: infra
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: —
result: (empty until proven)
commit: (empty until proven)
