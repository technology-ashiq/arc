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
decision: the slice's file set is the phase blast radius plus any path the slice title names in backticks — the only file list that exists deterministically per slice
result: 5 sources print for the fixture slice; all five names asserted individually, so a missing source fails rather than shrinking the list
commit: 7863710

#### slice: 02

title: the pack states which code-graph path ran — `codegraph` or `grep-fallback` — in both cases
kind: external-dep
risk: medium
proof: contract — `bats tests/develop-context-pack.bats` runs the same tree twice, once with a fake codegraph plus `.codegraph/` and once without, asserting the printed path name differs and is never absent
tier: contract
sources: phase-05-spec.md
decision: codegraph runs only when the repo holds a `.codegraph/` DIRECTORY; every other outcome — no index, non-zero exit, timeout, output naming no path this repo holds — downgrades to grep carrying the reason
result: both directions asserted, plus the failure direction: a stand-in exiting 1 prints `grep-fallback (codegraph exit 1)`
commit: 7863710

#### slice: 03

title: the same neighbourhood contract passes from both paths (the external-dependency contract test)
kind: external-dep
risk: medium
proof: contract — one shared assertion block in `bats tests/develop-context-pack.bats` is run against both adapters: repo-relative paths, sorted, deduped, capped, and a named `ran` in both
tier: contract
sources: phase-05-spec.md
decision: one assertion block, run against both adapters: repo-relative, forward-slashed, existing, sorted by code point, deduped, capped at 8, and a named path in both
result: the same helper passes from the codegraph path and the grep path; sortedness is checked under LC_ALL=C so the contract does not move with the runner's locale
commit: 7863710

#### slice: 04

title: a learning row's typed links are followed exactly one hop, and the resulting ADR / rule / fixture appear; a two-hop item provably does NOT appear — **including the case where that same item is also reachable one hop from a DIFFERENT matched row, where it must still surface by that other path.** Without this the absence test cannot tell a correct second-path inclusion from a transitive leak
kind: logic
risk: high
proof: unit — `bats tests/develop-context-pack.bats` seeds a ledger where the two-hop item is unreachable in one arrangement and one-hop-reachable from a second matched row in the other, and asserts absent then present
tier: unit
sources: phase-05-spec.md
decision: the boundary is structural, not a check — links are read from the matched ROW and the target is never opened, so there is no code path that could cross it
result: ADR-0901 absent when reachable only through ADR-0900's prose, present when L-102 links it one hop; the fresh pass confirmed it could not construct a transitive leak
commit: 7863710

#### slice: 05

title: churn names the top 3 files by commit count over the blast radius, computed from `git log`
kind: logic
risk: medium
proof: unit — `bats tests/develop-context-pack.bats` builds a history whose per-file commit counts are known by construction and asserts the printed top 3 and their counts
tier: unit
sources: phase-05-spec.md
decision: commit count per blast-radius file from one `git log` call, top 3, ties by code point; renames are NOT followed and dead paths are dropped with the count stated, because `--follow` takes one path and this is a set
result: alpha 4 / beta 3 / gamma 2 by construction, delta ranked 4th and excluded; a non-ASCII name and a renamed-away path each pinned after the fresh pass
commit: 7863710

#### slice: 06

title: every contributing source lands in the slice's `sources:` field, including ones that returned nothing
kind: logic
risk: medium
proof: integration — `bats tests/develop-context-pack.bats` reads the ledger file back after `next` and asserts the `sources:` line names all five sources, with a zero-count source present rather than omitted
tier: integration
sources: phase-05-spec.md
decision: the value is a token list this function alone may edit — it removes only the exact machine token it wrote and preserves everything else on the line
result: all five sources land, `churn(0)` present rather than omitted, and a hand-written annotation survives a rerun
commit: 7863710

#### slice: 07

title: a slice whose pack fell back to grep says so in `sources:` — asserted by a test that runs with no `.codegraph/` present
kind: external-dep
risk: medium
proof: contract — `bats tests/develop-context-pack.bats` runs the tree with no `.codegraph/` directory and asserts the persisted `sources:` line carries `grep-fallback`
tier: contract
sources: phase-05-spec.md
decision: the persisted token carries the REASON as well as the path name, so `no .codegraph/` and `codegraph exit 1` are distinguishable a week later
result: `code:grep-fallback(7; no .codegraph/)` asserted in the file with no `.codegraph/` present, and the two reasons asserted non-identical
commit: 7863710

#### slice: 08

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: high
proof: verified-real — a fresh agent that never saw the implementation constructs breaking inputs against the shipped source; every hole it finds is fixed and pinned as a test in `bats tests/develop-context-pack.bats`
tier: verified-real
sources: phase-05-spec.md
decision: two fresh agents, split by surface — one on the markdown/retrieval half, one on the external boundary — neither given the reasoning behind the code
result: 23 holes found, 8 of them wrong answers reported as right ones; all fixed and pinned as 25 executable tests. Three of the first batch's pins passed VACUOUSLY on a crashing probe, which CI caught and which is now impossible
commit: 61669a0

#### slice: 09

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: infra
risk: medium
proof: integration — a green GitHub Actions run on all 3 legs, its id recorded in `initiatives/develop/evidence/phase-05/ci-green.txt`
tier: integration
sources: phase-05-spec.md
decision: the shard weights were re-measured rather than hand-edited, and the balance test now asserts max(heaviest file, total/shards) instead of a constant derived from an under-measurement
result: CI run 30768154452 green on all 3 legs at head 777b49e; tree-manifest regenerated; manifest.json lists context-pack.mjs
commit: 777b49e

### Prediction scores

likely-failure-mode: miss — the one-hop boundary never leaked. A fresh agent tried to make it, pointing a matched row's `rule:` at the learning ledger itself, and got nothing: the target is never opened, so there is no path to cross. The prediction named the right risk and the wrong mechanism
likely-regression-site: hit — `modeNext`'s new write was the defect. Binding by slice id rather than by the reader's line sent one slice's pack into another slice's audit trail whenever an id was duplicated, found by the fresh pass and fixed with `at:`
likely-regression-site-2: unforeseen — the same write also wrapped assembly and recording in one try, so a read-only ledger printed a full pack and then called it unavailable
riskiest-file: hit — context-pack.mjs took 20 of the 23 holes, and every one of its four markdown readers had at least one
expected-blockers: hit — codegraph never ran for real here, and the fake was the only exercise of that leg; `git log` did differ across platforms, though by C-quoting non-ASCII names rather than by pathspec quoting
expected-proof-failures: miss — the churn test's git identity was right first time because the retro-log entry was read before writing it. What failed instead was nine probes importing a Git Bash path node cannot resolve, and three of those PASSED while doing nothing
