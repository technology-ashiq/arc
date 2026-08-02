# Build Brief — phase 05 · Context Pack: what past work already knows about this slice

spec-hash: sha256:bcfed25588514c0832bc8b8cf1037c58dc49d0d508252fd82b84f8f61e98d07b
lane: develop
reqs: REQ-05, REQ-06
adrs: 0111
blast-radius: .claude/scripts/develop/context-pack.mjs, docs/develop/learning-ledger.md, docs/retro-log.md
no-gos: A graph database or any new memory store, Automated promotion, Autonomous capability installation, Ambient research, Cross-platform dependency-version replay matrices, Rebuilding anything Cycle 5 shipped
blast-radius-dropped: 3

### Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.

### Predictions

likely-failure-mode: the one-hop boundary leaks — the expansion of a matched row's links re-reads the link TARGET for further links, so a two-hop item surfaces and looks like a correct second-path inclusion
likely-regression-site: `modeNext` in develop.mjs — it has only ever read the ledger, and writing `sources:` back in place is the first mutation on that path; an in-place rewrite that misidentifies the block edits the wrong slice
riskiest-file: .claude/scripts/develop/context-pack.mjs — one new reader over four markdown organs plus a subprocess adapter, every one of which has produced a parsing hole in this repo before
expected-blockers: codegraph is on PATH but this repo has no `.codegraph/`, so the real adapter can never run here and the codegraph leg is only ever exercised through a fake; and `git log` pathspec quoting differs across the three CI legs
expected-proof-failures: the churn test, because its history is built inside the test body and a clean Ubuntu runner has no global git identity (retro 2026-07-24, exit 128)

### Slices

#### slice: 01

title: `next` prints a pack carrying all five sources for a slice on the committed fixture
kind: logic
risk: high
proof: integration — `bats tests/develop-context-pack.bats` asserts `next` on the fixture tree prints a Context Pack naming all five sources by name
tier: integration
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: the pack states which code-graph path ran — `codegraph` or `grep-fallback` — in both cases
kind: external-dep
risk: medium
proof: contract — `bats tests/develop-context-pack.bats` runs the same tree twice, once with a fake codegraph plus `.codegraph/` and once without, asserting the printed path name differs and is never absent
tier: contract
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: the same neighbourhood contract passes from both paths (the external-dependency contract test)
kind: external-dep
risk: medium
proof: contract — one shared assertion block in `bats tests/develop-context-pack.bats` is run against both adapters: repo-relative paths, sorted, deduped, capped, and a named `ran` in both
tier: contract
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: a learning row's typed links are followed exactly one hop, and the resulting ADR / rule / fixture appear; a two-hop item provably does NOT appear — **including the case where that same item is also reachable one hop from a DIFFERENT matched row, where it must still surface by that other path.** Without this the absence test cannot tell a correct second-path inclusion from a transitive leak
kind: logic
risk: high
proof: unit — `bats tests/develop-context-pack.bats` seeds a ledger where the two-hop item is unreachable in one arrangement and one-hop-reachable from a second matched row in the other, and asserts absent then present
tier: unit
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: churn names the top 3 files by commit count over the blast radius, computed from `git log`
kind: logic
risk: medium
proof: unit — `bats tests/develop-context-pack.bats` builds a history whose per-file commit counts are known by construction and asserts the printed top 3 and their counts
tier: unit
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: every contributing source lands in the slice's `sources:` field, including ones that returned nothing
kind: logic
risk: medium
proof: integration — `bats tests/develop-context-pack.bats` reads the ledger file back after `next` and asserts the `sources:` line names all five sources, with a zero-count source present rather than omitted
tier: integration
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: a slice whose pack fell back to grep says so in `sources:` — asserted by a test that runs with no `.codegraph/` present
kind: external-dep
risk: medium
proof: contract — `bats tests/develop-context-pack.bats` runs the tree with no `.codegraph/` directory and asserts the persisted `sources:` line carries `grep-fallback`
tier: contract
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: high
proof: verified-real — a fresh agent that never saw the implementation constructs breaking inputs against the shipped source; every hole it finds is fixed and pinned as a test in `bats tests/develop-context-pack.bats`
tier: verified-real
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: infra
risk: medium
proof: integration — a green GitHub Actions run on all 3 legs, its id recorded in `initiatives/develop/evidence/phase-05/ci-green.txt`
tier: integration
sources: phase-05-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
