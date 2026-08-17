# Build Brief — phase 05 · The shim

spec-hash: sha256:19d3ea5e8597b2ec1100fe27f4f529ced5af8c68f266c959111e2a3db4cef80d
spec-hash-method: sha256 of the raw bytes of phases/phase-05-spec.md, computed at the time this
  ledger was written. **It is NOT comparable to phase-04-tasks.md's recorded hash**: recomputing
  that one the same way gives a different value, so the harness derives it some other way or the
  spec moved after generation. Recorded with its method rather than fabricated to look official.
lane: engine
reqs: REQ-01
adrs: 0031, 0069, 0203, 0204, 0209, 0210, 0219, 0902
blast-radius: .claude/scripts/engine/arc-run.mjs, .claude/scripts/engine/drivers/common.mjs, .claude/scripts/engine/drivers/hermes.mjs, .claude/scripts/engine/drivers/hermes.sh, .claude/scripts/engine/drivers/type-tagged-hash.mjs, products/engine/manifest.json, tests/engine-hermes-contract.bats, tests/engine-hermes-probe.mjs, tests/fixtures/engine/hermes/, tests/fixtures/sync-golden/tree-manifest.txt, tests/shard-timings.json
no-gos: isolation certification (phase 06), the router row / policy row / capped key (phase 07), the draft process and context packs (phase 08), any real job, runtime feature-parity chasing, a perfect parser, fixing the mock until it looks real

### Predictions, and what they were worth

likely-failure-mode: the output parser, on a shape the container produces and the vendor does not
  document. **CORRECT, and phase 04 had already measured it**: stdout is never clean.
likely-regression-site: common.mjs, shared with three other drivers and just modified by another
  lane. Held — the one change there is additive and narrow.
riskiest-file: hermes.mjs. **WRONG.** The riskiest thing in this phase turned out to be the TEST
  HARNESS, not the code: the red corpus was a shell script, and a shell script is not executable
  on any leg of this matrix from inside spawnSync. Every one of the 33 tests failed on all three
  OSes for that one reason, and the local check that passed beforehand had run the fixture
  through `bash` rather than through the driver — testing the fixture, not the path.
expected-blockers: none named. One arrived: `drivers/mock` and the `version` verb both already
  existed on origin/main from the bench lane, which the pre-edit collision check caught before a
  line was written.
expected-proof-failures: none named.

### Slices

#### slice: 01

title: **`drivers/hermes` on the real ENG-D contract.** `run PROCESS INPUT_JSON BUDGET`, one JSON
document on stdout, a cost sidecar when a cost was MEASURED, exit `0` ok / `1` driver-fail / `2`
budget-declined, and NOTHING added to the driver exit map (ADR-0219). Registered in arc-run's
`DRIVERS` list as one more driver, never a special guest.
kind: logic
risk: high
proof: one direct driver invocation per corpus case, through drivers/hermes.sh and not through a
recorded return value, asserting the observed exit code against the three-code map; plus
tests/engine-hermes-contract.bats asserting the ANSWER lands on stdout and diagnostics on stderr,
kept apart with `run --separate-stderr` so a driver printing its answer to stderr cannot pass
tier: verified-real
decision: The shim never retries and never escalates. ADR-0204's ladder is arc-run's: a schema
failure is arc-run's judgement AFTER a 0 exit. A driver that retried on its own would multiply the
run budget silently. It also never JUDGES the output — validating it against the process schema is
arc-run's job, and a driver that pre-judges reports a process fault as a driver fault.
result: PROOF PASSED locally per case; CI is the gate and is named in slice 06. clean 0 · empty 1 ·
junk 1 · nonzero 1 · scalar-last 0 · spent deadline 2 · hang 2 · oversize under a small ceiling 1.
commit: 230f49f

#### slice: 02

title: **The parser is built around the phase-04 finding: stdout is NEVER clean.** Extraction scans
BACKWARDS for the last line that parses as a JSON object or array. Backwards, because a warning
after the answer takes a naive last-line reader off the end. Object-or-array, because `JSON.parse`
accepts `42`, `true` and `null`, so a boot counter would be returned as the model answer and the
run would go green having reported nothing.
kind: logic
risk: high
proof: sixteen corpus cases delivered as BYTES ON A CHILD PROCESS STDOUT, substituting only the
docker binary — the real spawn, the real capture, the real ANSI strip, the real backwards scan and
the real exit mapping all execute. ARC_DRIVER_FAKE is deliberately NOT used: it returns inside
common.mjs before produce() is ever called, which is the defect bench pinned as a canary.
tier: verified-real
decision: Two behaviours pinned as LIMITS rather than wins, so they are visible instead of
discovered — a JSON-shaped log line printed AFTER the answer wins (backwards scanning cannot tell
a structured log from an answer), and with two candidate answers the last one wins. Both are
asserted, so the day either stops holding, CI says so rather than a wrong draft saying so.
result: PROOF PASSED. The ANSI, ANSI-flood, CRLF, scalar-after, warning-after, truncated, junk,
empty, whitespace-only, injection-shaped, two-answer, oversize and hang cases all behave as
asserted. The buffer ceiling is env-overridable ONLY so its refusal branch can be proven to
execute: the same bytes pass under the real ceiling and are refused under a small one.
commit: 230f49f

#### slice: 03

title: **The wall-clock belongs to the RUN.** arc-run passes `ARC_DRIVER_DEADLINE_EPOCH_MS`, an
ABSOLUTE instant, so time already burned is already subtracted and cannot be un-subtracted. A
timeout is `reason: budget`, exit `2`, never `reason: driver`. The container is torn down BY NAME,
because it outlives the CLI that started it and `--rm` alone does not clean up after a kill.
kind: logic
risk: high
proof: a fixture whose deadline is already spent must decline at exit 2 WITHOUT starting the
runtime — proven by using the `clean` case, which would exit 0 if it were ever started; a fixture
that writes a valid answer and then hangs must exit 2; and a NEGATIVE CONTROL with no deadline in
the environment must exit 0, because otherwise a shim that declined everything would pass both
tier: verified-real
decision: `budget.min` is the run's ORIGINAL allowance and is never used as a clock here. A shim
reading it would hand every driver in the fallback chain a full budget again — the defect arc-run
already records at its own timeout arm. A test pins that a `min=99` budget cannot override a spent
deadline.
result: PROOF PASSED. Spent deadline → 2 without starting. Hang + deadline → 2. No deadline → 0.
`min=99` + spent deadline → 2.
commit: 230f49f

#### slice: 04

title: **A hole in the SHARED contract, closed narrowly.** A real driver could not decline for
budget at all: only the `ARC_DRIVER_FAKE` path could reach exit 2, so "the budget arm is covered"
was a statement about a fixture and not about the code. `common.mjs` now honours `e.arcExit`, and
honours ONLY `BUDGET_DECLINED`.
kind: logic
risk: medium
proof: an arcExit naming anything other than BUDGET_DECLINED is ignored rather than obeyed — the
exit map is 0/1/2 and this cycle adds nothing to it (ADR-0219)
tier: contract
decision: Narrow on purpose. A driver able to request an arbitrary exit code is a driver able to
widen the contract without a reviewed diff.
result: PROOF PASSED. hermes reaches exit 2 through the real produce() path, which no driver could
do before.
commit: 230f49f

#### slice: 05

title: **The pinned config hash, and its preimage named.** `version` returns the pinned runtime plus
a config hash over three named things (ADR-0209): the runtime config file, the egress/network
policy, and the vetted skill list. Each is hashed through a TOTAL type-tagged encoder that refuses
what it cannot represent, because a canonicaliser that silently coerces is a collision generator.
kind: logic
risk: high
proof: the encoder REFUSES sixteen classes of value and coerces none; eight pairs that
JSON.stringify collides on do not collide here; key ORDER does not move the hash and key CONTENT
does; and a NEGATIVE CONTROL proves the same harness reports a collision when one genuinely exists
tier: verified-real
decision: An UNCONFIGURED component is encoded as unconfigured rather than dropped. Dropping it
would make a run with no egress policy hash identically to a run whose policy file happens to be
missing — and those two states mean opposite things about whether anyone decided anything. A test
pins that absent and missing hash differently.
result: PROOF PASSED, and **the corpus caught a bug in its own encoder**. The sparse-array guard
was written inside an `Array.prototype.map` callback, and map SKIPS holes — so the guard never
executed for the case it existed to catch, and `[1, hole, hole, 4]` encoded as though the holes
were not there. The refusal corpus reported 15 of 16 refused and NAMED the survivor. Rewritten as
an indexed loop. `version` → `hermes@sha256:16788311e2fa+cfg.5b9d90ff2037`.
commit: 230f49f

#### slice: 06

title: **The red corpus runs on all three CI legs, or it is not a seam.**
kind: logic
risk: high
proof: CI, read per-JOB, with the run head SHA confirmed equal to local HEAD
tier: verified-real
decision: The corpus is a `.mjs` and drivers/hermes.mjs runs a docker value ending `.mjs`/`.js`
through `process.execPath`. Production is untouched — `docker` has no such suffix.
result: **FAILED FIRST, and the failure is the point.** As a `.sh` it failed on ubuntu and macOS
with EACCES (a fixture committed at mode 100644 has no execute bit) and on windows because Node
cannot execute a shebang script there at all. All 33 tests, all three OSes, one cause. The local
check that passed beforehand had run the fixture through `bash` rather than through the driver.
Fixed in 4a4bbe0. A second, unrelated CI failure followed and is recorded in slice 07.
commit: 4a4bbe0

#### slice: 07

title: **One unbalanced quote in a new guard file took a whole CI shard down.**
kind: logic
risk: medium
proof: every `tests/*.bats` shell-parses the way gather reads it, with `@test NAME {` rewritten to
a plain function header — the only transformation bats applies
tier: verified-real
decision: The apostrophe that test needs is now BUILT with printf and an octal code point rather
than typed, so no tool reading the file has to agree with any other about the escape.
result: PROOF PASSED after failing. The standard escape idiom for an apostrophe inside a
double-quoted string in a @test body defeated bats own preprocessor —
`unexpected EOF while looking for matching "` — so the file could not be GATHERED and nothing in
its shard ran. The reconcile step is what caught it: **declared 2435, executed 1**. A file that
fails to gather is indistinguishable from one whose tests all passed, except for that count. The
irony is worth keeping: the file that broke gather was the file added to enforce the quoting rule.
commit: 43e489a

#### slice: 08

title: **`drivers/mock` — reused, not rebuilt.** The spec lists a replay driver as an exit
criterion. It already exists on `origin/main` from the bench lane (ADR-0902), and it already
satisfies this phase's criterion exactly: it IS a `produce()`, so runDriver's whole real path runs
and only the RESPONSE is swapped, and its negative control proves that by discrimination rather
than by patching.
kind: logic
risk: low
proof: the pre-edit collision check on `.claude/scripts/engine/drivers/` — `git log origin/main
--oneline -5 -- PATH` — run BEFORE any code was written
tier: contract
decision: Engine builds nothing here. The same check also found that the `version` verb already
exists in common.mjs as an opt-in provider scoped to two drivers, so this phase's `--version`
criterion is a matter of passing a provider rather than adding a verb; and that
`products/engine/manifest.json` plus the sync-golden manifest are MANDATORY companions of any
drivers/** change, which bench paid one red CI cycle to learn.
result: PROOF PASSED. Three exit criteria satisfied by another lane's merged work, caught before a
line was written. This is the entire reason the collision check is a non-negotiable.
commit: 685d1ef

#### slice: 09

title: **Adversarial pass by TWO fresh agents on different surfaces, against the OUTPUT PARSER**,
neither having seen the implementation, their prompt carrying this cycle's running list of
already-fixed defects with the instruction to check each one in every OTHER file. Every hole found
is pinned as a red fixture.
kind: logic
risk: high
proof: two reports at `initiatives/engine/evidence/phase-05/`, each recording the agent session id
and an explicit statement that it read no implementation file, plus one pinned fixture per hole
tier: (not proven)
decision: **OWED, and not satisfied by the round-3 pass.** Two fresh agents did run in this cycle
and found 24 holes with 16 surviving mutants — but they attacked `capability-vet.sh`, which is
Phase 04's gate. The parser in `drivers/hermes.mjs` has NOT been attacked by anyone who did not
write it. The phase spec is explicit that this happens BEFORE the PR that ships it merges, never
deferred to the phase close, so this blocks the close rather than riding it.
result: NOT PROVEN — owed, and named rather than quietly counted as done.
commit: (pending)

#### slice: 10

title: **Each driver artifact passes `scanSecrets()`, with a negative control proving the check can
fail.** stdout, transcript, cost sidecar and spine payload.
kind: logic
risk: medium
proof: a planted key in each of the four artifact classes is caught, and a negative control shows
the check going red
tier: (not proven)
decision: arc-run already scrubs all four at `attempt()`, so the MECHANISM exists and is shared.
What is missing is the proof that it holds for THIS driver with a negative control — and a check
inherited without a negative control is a check nobody has seen fail.
result: **PROVEN 2026-08-16** — `tests/engine-hermes-secrets.bats`, 9 tests, all four REQ-03 artifact
  classes driven through `arc-run` on the REAL hermes path (only the docker binary substituted;
  `ARC_DRIVER_FAKE` deliberately unused because it short-circuits `common.mjs` before `produce()`).
  Negative control asserts a clean run BOTH passes the scrub AND produces its answer — a failed run
  also reports no secret. Two mutants killed: removing the transcript forward reddens class 2,
  deleting the ADR-0221 seam from `emitRun` reddens the end-to-end receipt test.
  **AND WRITING IT FOUND THE HOLE IT WAS WRITTEN TO LOOK FOR.** The runtime's stderr was DISCARDED
  on every successful run — read only to pull a reason line when the container exited non-zero — so
  `arc-run`'s transcript scrub never saw it, and a planted key passed straight through. Measured,
  with a fixture, before it was fixed. ADR-0215 keeps a trail per dispatch precisely because
  injection shows in trails, and the runs where that matters are the ones whose answer looks clean.
  The earlier inherited coverage in `engine-driver-contract.bats` could not have caught it: it
  proves the fake path, and one class of four.
commit: (pending)

#### slice: 11

title: tests added & green **on CI, read per-JOB**, run head SHA equal to local HEAD; tracker
updated (PROGRESS row ✅ + done-log).
kind: logic
risk: medium
proof: `gh run view <id> --json jobs`, asserting on the per-job conclusions rather than on a
watcher's exit code, after confirming a run EXISTS for the SHA
tier: (not proven)
decision: A run does not always follow a push in this repo — it has to be confirmed and sometimes
dispatched by hand.
result: NOT PROVEN — in flight. Two CI failures found and fixed en route (slices 06 and 07); the
current run is the first that could be green.
commit: (pending)
