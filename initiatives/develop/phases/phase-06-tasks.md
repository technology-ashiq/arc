# Build Brief — phase 06 · Capability acquisition: find it, pin it, and refuse it by default

spec-hash: sha256:fdf974b5c2cf4aba76736881216f7be20d45dbd28d6c213e7fbbc5e37e60d7f5
lane: develop
reqs: REQ-07, REQ-08
adrs: 0110
blast-radius: .claude/agents/capability-scout.md, .claude/commands/arc-capability.md, .claude/scripts/develop/capability-vet.sh, CLAUDE.md, products/develop/manifest.json
no-gos: A graph database or any new memory store, Automated promotion, Autonomous capability installation, Ambient research, Cross-platform dependency-version replay matrices, Rebuilding anything Cycle 5 shipped
blast-radius-dropped: 10

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

title: `/arc-capability <need>` returns a proposal table and writes nothing outside its report
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `capability-vet.sh` BLOCKs a candidate missing any one of: allowlist, version, hash, provenance, clean content scan — asserted **once per missing condition**, not once in total
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: a write-capable candidate BLOCKs without a recorded human OK, and passes with one
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: the content scan catches a planted exfil pattern and a planted `curl | sh` — separate fixtures
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **write-capability is computed, and an unreadable candidate is treated as write-capable** — a fixture whose source cannot be scanned must route to the human-OK path, not pass
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: a candidate whose own manifest claims `readOnlyHint: true` while its source writes files is still classed write-capable — the self-report never overrides the scan
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: a candidate that does not exist is refused at the existence check, before anything else runs
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **the vet script never installs** — asserted: a fixture with a hostile `postinstall` is fetched and scanned without that script ever executing
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **a REAL candidate is vetted, and not installed** — the madge / dependency-cruiser gap Cycle 5 recorded as debt is run through the gate for real: actual published version, actual hash, actual provenance, actual content scan, written to `capability-lock.json`. Vetting is not installing (ADR-0110 separates them), so arc gains a lock row and **no dependency**. This is the only thing that tests assumption row 5 instead of asserting it, and it is what stops the gate being a rubber stamp proven on a candidate built to pass it
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: `capability-lock.json` records version, hash, provenance and the date checked; staleness past 30 days is reported
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: every BLOCK has a negative control proving it can fail, and a matched fixture that must PASS
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: `products/develop/manifest.json` lists `capability-vet.sh` under `scripts`, `arc-capability.md` under `commands` and `capability-scout.md` under `agents` — Cycle 5's CI caught exactly this omission when a script shipped without its manifest entry
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: root `CLAUDE.md` gains `/arc-capability` in its `## Commands` list — a new top-level entry point that is absent by construction until something adds it
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 15

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
