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

likely-failure-mode: the content scan is a pattern list and will be evaded by an input nobody thought of, so the DEFAULT (opaque and unreadable are write-capable) is what actually carries the gate
likely-regression-site: the shell/JSON boundary — every field is read out of an attacker-written file and compared with grep
riskiest-file: .claude/scripts/develop/capability-vet.sh — a shell script reading attacker-controlled JSON and source
expected-blockers: the real candidate needs network and a registry that publishes integrity and attestation data; and admitting anything write-capable needs Ashiq, which no session can supply
expected-proof-failures: the macOS leg, because grep and sed differ there and this phase is mostly grep and sed

### Slices

#### slice: 01

title: `/arc-capability <need>` returns a proposal table and writes nothing outside its report
kind: logic
risk: high
proof: integration — one real scout run recorded in `evidence/phase-06/scout-run.md`, plus `bats tests/develop-capability.bats` asserting the agent has no write tools and the command states its limit
tier: integration
sources: phase-06-spec.md
decision: the scout is an agent with no write tools and the command states its own limit; the proposal table is its whole output
result: one real run against arc's own recorded debt returned 5 rows, wrote nothing, marked two facts `unknown` rather than guessing, and volunteered that it had not searched for one of the three needs — `evidence/phase-06/scout-run.md`
commit: 83c7db7

#### slice: 02

title: `capability-vet.sh` BLOCKs a candidate missing any one of: allowlist, version, hash, provenance, clean content scan — asserted **once per missing condition**, not once in total
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats`, one BLOCK test per condition against a fixture differing from `clean` in exactly one way
tier: contract
sources: phase-06-spec.md
decision: every condition is evaluated and reported; only `existence` short-circuits, because a name that resolves to nothing makes every later opinion read as though the thing exists
result: one BLOCK test per condition, each fixture differing from `clean` in exactly one way, so a refusal names its own cause
commit: 83c7db7

#### slice: 03

title: a write-capable candidate BLOCKs without a recorded human OK, and passes with one
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` asserts both directions, plus a fabricated and a future date
tier: contract
sources: phase-06-spec.md
decision: write-capable is a class, not a veto: it PASSES with a recorded `human-ok: <name> <ISO date>` that must be a real past calendar date
result: both directions asserted; `0000-00-00` and a future date both refused
commit: 98887a3

#### slice: 04

title: the content scan catches a planted exfil pattern and a planted `curl | sh` — separate fixtures
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` over two separate fixtures, `exfil/` and `curl-pipe-sh/`
tier: contract
sources: phase-06-spec.md
decision: two separate fixtures, never one file carrying both — a single fixture cannot tell which pattern fired
result: `exfil/` and `curl-pipe-sh/` each BLOCK on content-scan; the pipe pattern now covers `| /bin/sh`, `| node`, `| python3` and a URL containing `&`
commit: 98887a3

#### slice: 05

title: **write-capability is computed, and an unreadable candidate is treated as write-capable** — a fixture whose source cannot be scanned must route to the human-OK path, not pass
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` over `unreadable/`, `decoy-readable/`, `nul-byte/`, `hook-in-src/`, `dynamic-require/`
tier: contract
sources: phase-06-spec.md
decision: silence means yes — an opaque file, an unreadable tree, an install hook, or a module specifier built at run time are all write-capable
result: `unreadable/`, `decoy-readable/`, `nul-byte/`, `hook-in-src/` and `dynamic-require/` all route to the human-OK path
commit: 98887a3

#### slice: 06

title: a candidate whose own manifest claims `readOnlyHint: true` while its source writes files is still classed write-capable — the self-report never overrides the scan
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` over `self-report-lies/`, whose manifest claims read-only while its source writes
tier: contract
sources: phase-06-spec.md
decision: the candidate's own `declared-read-only` is printed as a claim and never consulted for the verdict
result: `self-report-lies/` BLOCKs on human-ok with the scan's finding, and the run prints that the scan disagrees and the scan wins
commit: 83c7db7

#### slice: 07

title: a candidate that does not exist is refused at the existence check, before anything else runs
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` asserts the existence verdict is FIRST, and that `self-certified/` cannot cite itself
tier: contract
sources: phase-06-spec.md
decision: existence means a registry response was RECORDED at a fixed filename and parses and names this candidate — not that a lookup happened somewhere
result: asserted first-in-order, and `self-certified/` proves a candidate cannot cite its own source file as proof it exists
commit: 98887a3

#### slice: 08

title: **the vet script never installs** — asserted: a fixture with a hostile `postinstall` is fetched and scanned without that script ever executing
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` asserts the marker file is absent, plus a grep of the script for any install verb
tier: contract
sources: phase-06-spec.md
decision: the gate reads an already-fetched tree as data; there is no install verb anywhere in the file
result: `hostile-postinstall/`'s marker file is absent after a run, and a grep for any package-manager install verb finds none
commit: 83c7db7

#### slice: 09

title: **a REAL candidate is vetted, and not installed** — the madge / dependency-cruiser gap Cycle 5 recorded as debt is run through the gate for real: actual published version, actual hash, actual provenance, actual content scan, written to `capability-lock.json`. Vetting is not installing (ADR-0110 separates them), so arc gains a lock row and **no dependency**. This is the only thing that tests assumption row 5 instead of asserting it, and it is what stops the gate being a rubber stamp proven on a candidate built to pass it
kind: logic
risk: medium
proof: verified-real — madge@8.0.0 fetched from npm, integrity verified byte-for-byte, run through the real gate; transcript in `evidence/phase-06/real-candidate-madge.md`
tier: verified-real
sources: phase-06-spec.md
decision: vet the candidate the phase was written to admit, and record whatever the gate says rather than what the exit criterion wanted it to say
result: madge@8.0.0 fetched with `npm pack`, integrity verified byte-for-byte, and REFUSED: `src/lib/graph.js:8` spawns `child_process`. Recorded in `capability-lock.json` under `refusals` — `evidence/phase-06/real-candidate-madge.md`
commit: 83c7db7

#### slice: 10

title: `capability-lock.json` records version, hash, provenance and the date checked; staleness past 30 days is reported
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` over the lock row shape and five `--audit` behaviours
tier: contract
sources: phase-06-spec.md
decision: the lock file records DECISIONS, not only admissions — a refusal keeps the facts that were established so the same candidate is not re-proposed blind
result: row shape asserted; `--audit` reports rows over 30 days, counts an unparseable or future date as stale, examines refusals too, and exits non-zero so CI can gate on it
commit: 98887a3

#### slice: 11

title: every BLOCK has a negative control proving it can fail, and a matched fixture that must PASS
kind: logic
risk: medium
proof: contract — `bats tests/develop-capability.bats` runs three PASS fixtures in the same suite as the refusals
tier: contract
sources: phase-06-spec.md
decision: a gate that refuses everything satisfies every refusal test and is worthless, so the PASS half is load-bearing
result: three candidates PASS in the same run the others fail — a clean npm package, a write-capable one with a recorded OK, and a skill pinned by commit SHA
commit: 98887a3

#### slice: 12

title: the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
kind: logic
risk: medium
proof: verified-real — two fresh agents, 23 findings, 25 fixtures pinned in `bats tests/develop-capability.bats`
tier: verified-real
sources: phase-06-spec.md
decision: two fresh agents, split by surface — one on decision logic, one on the shell and portability — neither given the reasoning behind the code
result: they defeated ALL SEVEN checks and got a candidate with child_process, curl|sh, env exfiltration and an /etc/cron.d write to `PASS — read-only`. One root cause: untrusted multi-line strings fed to line-oriented grep and sed. 25 fixtures pinned, metadata half rewritten structurally
commit: 98887a3

#### slice: 13

title: `products/develop/manifest.json` lists `capability-vet.sh` under `scripts`, `arc-capability.md` under `commands` and `capability-scout.md` under `agents` — Cycle 5's CI caught exactly this omission when a script shipped without its manifest entry
kind: logic
risk: medium
proof: static — `bats tests/develop-capability.bats` reads `products/develop/manifest.json` and asserts all three entries
tier: static
sources: phase-06-spec.md
decision: manifest entries land in the same commit as the files, not at phase close
result: `capability-vet.sh` under scripts, `arc-capability.md` under commands, `capability-scout.md` under agents, plus the allowlist and lock file under files — asserted by a test that reads the manifest
commit: 83c7db7

#### slice: 14

title: root `CLAUDE.md` gains `/arc-capability` in its `## Commands` list — a new top-level entry point that is absent by construction until something adds it
kind: logic
risk: medium
proof: static — `bats tests/develop-capability.bats` greps root `CLAUDE.md` for `/arc-capability`
tier: static
sources: phase-06-spec.md
decision: a new top-level entry point is announced where the other commands are listed, or nothing tells anyone it exists
result: root CLAUDE.md carries `/arc-capability` with its ADR reference and its `installs nothing` limit; asserted by a grep test
commit: 83c7db7

#### slice: 15

title: tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated
kind: logic
risk: medium
proof: integration — CI run 30771652000 green on all 3 legs at head 6489684
tier: integration
sources: phase-06-spec.md
decision: green on all three legs before the phase closes, never on one
result: CI run 30771652000 green at head 6489684; tree-manifest regenerated; tracker updated
commit: 6489684

### Prediction scores

likely-failure-mode: hit — but far worse than predicted. The scan was not merely evaded by an unforeseen input; ALL SEVEN checks fell, and the default that was supposed to carry the gate was itself defeated by one README beside a compiled blob
likely-regression-site: hit — every critical finding traced to that one boundary. A newline in `name` made `grep -qxF` a multi-pattern match; `registry-record` was an attacker-chosen path; the hash was never compared; a `\` in the candidate path voided the whole scan through a sed expression
riskiest-file: hit — capability-vet.sh took every one of the 23 findings across both passes; no other file had any
expected-blockers: hit — madge published integrity but no attestation, and it is write-capable, so it needs Ashiq's line and no session can write it. The lock file records the refusal rather than a fabricated approval
expected-proof-failures: hit — `(ba|z|d|)sh` used an EMPTY alternation branch, undefined in POSIX ERE. GNU grep accepted it, BSD grep on macOS did not, and `curl | sh` passed on exactly one of three legs
process-deviation: unforeseen — this block was filled in AFTER the build rather than before it, which is the harness's own rule broken by the session that owns the harness. The predictions above are what the red-test commit message recorded before any implementation existed, not a reconstruction, but the field was not populated at the time and that is a deviation, not a detail
