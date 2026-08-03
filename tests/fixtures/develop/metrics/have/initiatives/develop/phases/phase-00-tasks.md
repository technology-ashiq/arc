# Build Brief — phase 00 · fixture

spec-hash: sha256:0000000000000000000000000000000000000000000000000000000000000000
lane: develop

### Slices

#### slice: 01

title: the first thing
kind: logic
proof: unit — `bats x`
tier: unit
result: done
commit: aaa1111

#### slice: 02

title: the second thing
kind: logic
proof: unit — `bats y`
result: done
commit: bbb2222

#### slice: 03

title: the third thing
kind: logic
proof: (empty until proven)
tier: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

### Prediction scores

likely-failure-mode: hit — the parser was the problem
likely-regression-site: miss — nothing regressed there
riskiest-file: hit — it took every finding
