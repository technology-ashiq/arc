# Build Brief — phase 01 · Board

spec-hash: sha256:1d0e48cd2b7f646c9c56000a89e98cbd8b59789143f77ed1052231b9d062652f
lane: evolve
reqs: 
adrs: 0302, 0308
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

likely-failure-mode: a reducer that counts an uncollected window as zero, handing a challenger a lead built out of a collection gap
likely-regression-site: the spine emitter and validators, since the board only reads
riskiest-file: .claude/scripts/evolve/board.mjs
expected-blockers: none foreseen; the board only reads, so it cannot corrupt the spine
expected-proof-failures: red-before-green on `arc evolve board` not existing

### Slices

#### slice: 01

title: Board renders from the reader only — no direct spine file reads anywhere in the path
kind: logic
risk: high
proof: contract - `spine-reader-lint.sh` globs .claude/scripts/evolve as well as hq, and a bats case asserts BOTH that the lint passes and that it actually covers this directory
tier: contract
sources: phase-01-spec.md
decision: the lint's glob was widened rather than the board being audited by eye - a spine consumer outside the lint's file list is a consumer nothing checks, and the next evolve module is covered without editing the lint
result: green in CI run 30851431809 (19 jobs, 0 failures); board.mjs contains no path to events/*.jsonl or state.db
commit: 65972e9

#### slice: 02

title: **Replay determinism:** wipe derived state → replay spine → board is byte-identical; and a fixture with two receipts sharing the same `ts` from different `actor`s (concurrent emitters) replays to the same board regardless of on-disk append order — the reducer sorts on a total order key (`ts` + `id`), never on file-arrival order
kind: logic
risk: medium
proof: contract - two same-ts receipts from different actors are written to a day file in BOTH orders and the two boards are diffed
tier: contract
sources: phase-01-spec.md
decision: the reader yields {event, day, seq} rows and day+seq (the physical append position) are deliberately DROPPED; the fold sorts on (parsed ts, id, sha) so a duplicate id still orders deterministically
result: byte-identical in both orders; CI run 30851431809 (19 jobs, 0 failures). A numeric ts from a foreign line made the comparator INCONSISTENT (both directions false) and V8's sort order then depended on input - that line is now refused on read
commit: 65972e9

#### slice: 03

title: State `PENDING` renders below-floor surfaces with n-per-arm progress
kind: logic
risk: medium
proof: contract - an experiment below floor renders PENDING with n/floor per arm
tier: contract
sources: phase-01-spec.md
decision: progress counts DISTINCT units in COMPLETE windows, so a surface cannot inch toward its floor on half-collected data
result: green in CI run 30851431809 (19 jobs, 0 failures)
commit: 65972e9

#### slice: 04

title: Staleness renders loudly with an age (e.g. `last metric 12d ago`)
kind: logic
risk: medium
proof: contract - a regex assertion that the age is `<n>d ago`, not a bare stale flag
tier: contract
sources: phase-01-spec.md
decision: a receipt AHEAD of the clock renders MISSING rather than a negative age - `-47d ago` sorts to the freshest end of any staleness sweep
result: green in CI run 30851431809 (19 jobs, 0 failures)
commit: 65972e9

#### slice: 05

title: **`MISSING`** renders for any incomplete window — never rendered or counted as zero
kind: logic
risk: medium
proof: contract - THE load-bearing case: 3 units measured for +champion, 2 of them in a window where +challenger-a reported nothing; the board must print 1, not 3
tier: contract
sources: phase-01-spec.md
decision: a MISSING window contributes to NO arm. Counting the arm that did report, while its opposite reported nothing, is the asymmetry that manufactures a winner out of a collection gap
result: prints 1/1800; a reducer that summed the absent arm as zero passes every OTHER test in the file. CI run 30851431809 (19 jobs, 0 failures)
commit: 65972e9

#### slice: 06

title: `insufficient evidence` renders for council metrics below floor
kind: logic
risk: medium
proof: contract - a below-floor arm renders `insufficient evidence: <arm> n<floor>`
tier: contract
sources: phase-01-spec.md
decision: rendered per arm with the actual numbers, so the reader sees how far short it is rather than a bare label
result: green in CI run 30851431809 (19 jobs, 0 failures)
commit: 65972e9

#### slice: 07

title: **Stream separation (ADR-0302):** experiment panels read `experiment.measured`; the baseline-panel path is proven ONLY against `MISSING`, since `metric.observed` is not a member of `KINDS` this cycle (ADR-0308) and no closed-payload validator for it exists — the "never summed" two-kind fixture is **deferred to the client's cycle**, when a legitimately validated `metric.observed` receipt first exists. Building one here would be doing EVO-H0's work inside this lane, which is a no-go
kind: logic
risk: medium
proof: contract - experiment panels read experiment.measured only; the baseline path is proven ONLY against MISSING
tier: contract
sources: phase-01-spec.md
decision: the two-kind never-summed fixture is DEFERRED to the client's cycle exactly as the spec directs - building a metric.observed receipt here would be doing EVO-H0's work inside this lane, which is a no-go
result: green in CI run 30851431809 (19 jobs, 0 failures); metric.observed remains outside KINDS and its refusal is pinned in evolve-receipts.bats
commit: 65972e9

#### slice: 08

title: Baseline panels render `MISSING` today, since `metric.observed` is not in `KINDS` and no client feed exists — the absent feed is displayed honestly, not faked or zeroed
kind: logic
risk: medium
proof: contract - the baseline row renders MISSING and names ADR-0308, and the ROW IS PRESENT rather than omitted
tier: contract
sources: phase-01-spec.md
decision: a vanished row reads as `nothing to report`; the absent feed is displayed honestly
result: green in CI run 30851431809 (19 jobs, 0 failures)
commit: 65972e9

#### slice: 09

title: No invented numbers anywhere in the output
kind: logic
risk: medium
proof: contract - an empty spine asserts no ` 0/` anywhere, and a hostile manifest is REJECTED rather than rendered
tier: contract
sources: phase-01-spec.md
decision: the CLI now LINTS every manifest with checkEvolveSection instead of bare JSON.parse - a manifest with 47 findings previously rendered a fabricated observation count and a fabricated module
result: green in CI run 30851431809 (19 jobs, 0 failures); 15 adversarial breaks fixed and pinned
commit: 65972e9

#### slice: 10

title: tests added & green in CI
kind: logic
risk: medium
proof: contract - `bats tests/evolve-board.bats` on the full CI matrix
tier: contract
sources: phase-01-spec.md
decision: no local test runs: CI is the only gate, per the owner's standing instruction
result: CI run 30851431809 (19 jobs, 0 failures) green; the two prior red runs are recorded in the commit log rather than amended away
commit: 65972e9

#### slice: 11

title: live demo run + output checked
kind: logic
risk: medium
proof: verified-real - `arc-evolve board` run against a real sandboxed spine, output read
tier: verified-real
sources: phase-01-spec.md
decision: running it rather than reading it found two bugs in minutes: query() returns {events,torn,engine} not an array, and `torn` is an ARRAY whose empty form is truthy
result: the demo render is in the commit log; incomplete window correctly excluded from the count
commit: 65972e9

#### slice: 12

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: static - PROGRESS.md row + done-log, PORTFOLIO row, board-drift green in CI
tier: static
sources: phase-01-spec.md
decision: the phase row flips only after CI is green
result: done
commit: 65972e9

### Prediction scores

**These were written at slice start this time, before any board code existed.**

likely-failure-mode: hit -- 55f5d0d. A reducer counting an uncollected window as zero was exactly the defect, and it was the FIRST thing the load-bearing test pinned. It was not the only one: the fresh agent found 14 more, so the prediction was right and nowhere near sufficient
likely-regression-site: miss -- 65972e9. I said the emitter and validators, on the reasoning that the board only reads. The regression was INSIDE the board: an order dependency in its own fold, and the reader handing back {event,day,seq} rows rather than events
riskiest-file: hit -- 55f5d0d. board.mjs took all 15 breaks
expected-blockers: miss -- 65972e9. "The board only reads, so it cannot corrupt the spine" is true and irrelevant: a board that reads WRONG is a board that lies, and three CI rounds were spent on it
expected-proof-failures: unforeseen -- 63ddb93. Red-before-green happened as predicted. What I did not predict is that four of my OWN hole-pinning tests would fail on a DUP_IDEM -- the emitter correctly refusing fixtures I had built wrong, because `arm` is not in the measured idem

### Debt ledger

- **what:** the board reads product manifests from disk on every render.
  **where:** `.claude/scripts/evolve/arc-evolve.mjs` `declaredModules()`.
  **why accepted:** manifests are in-tree config, so the render stays deterministic for a given commit; and the alternative (a receipt declaring the contract) is Phase 02/03 work.
  **cost of leaving it:** a board rendered against a different checkout of the same spine can differ, so board output is only comparable within one commit.
  **pay-down trigger:** the first time a board render is compared across two commits as evidence.

