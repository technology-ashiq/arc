# Phase 00 — the road + steel thread

**Goal (one line):** build the substrate bench was supposed to inherit — a replay driver, a
version verb, an assertion schema and a fixture-repo harness — and run one fixture end to end
through it, so the thinnest possible bench thread is real before any scoring machinery is built.
**Appetite:** 3.0 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** none

## Mechanics pinned at kickoff

The simulation gate returned 10 blockers against the first draft of this spec. Each is answered
here, verified against the tree, so the executor never guesses.

**M1 · How bench invokes a driver.** Bench **shells out to `arc-run.mjs` once per attempt** — it
never spawns `drivers/NAME.sh` itself.

**Why, stated accurately.** Policy is NOT the reason: `common.mjs:156-168` carries a second gate
inside `runDriver()`, so a direct spawn is already policed (that comment block explains it —
*"a gate with one call site is only sole-entry if nothing else can call the thing it guards"*).
The reason is operational: a direct spawn bypasses the **run-level budget remainder** (REQ-04),
the **`run.completed` receipt**, and the **contract-retry ladder**, none of which the driver-level
gate knows about. Phase 4's mutant must therefore be rejected *for that reason*, not merely
rejected — a mutant stopped by the policy gate would prove nothing about bench's budget or
receipt discipline.

```
node .claude/scripts/engine/arc-run.mjs --process PROCESS --driver DRIVER --input @FILE --budget inr=REMAINING
```

Three env vars are set per attempt, and this is the complete list: **`ARC_ROOT`** = the
materialized fixture repo (M3) · **`ARC_DRIVER_MODEL`** = the candidate model id ·
**`ARC_MOCK_FIXTURE`** = the fixture id, which the mock uses to pick its recording (M2).
`ARC_MOCK_FIXTURE` and `repo_state` and the `repo-states/` directory name are **all the same
identifier** — one FIXTURE-ID per fixture, used in three places.

**The run-level remainder is threaded by bench**: it computes `REMAINING` before each attempt and
passes it down, so `arc-run`'s per-invocation `--budget` becomes the mechanism rather than a
competing budget (REQ-04).

**M2 · Where the mock's pinned bytes live, and how it picks one.** `ARC_MOCK_DIR` (default
`tests/fixtures/bench/mock-replay/`). The mock resolves **`PROCESS/FIXTURE-ID.json`**, where
`FIXTURE-ID` comes from **`ARC_MOCK_FIXTURE`**, set by bench before each attempt; with that env
unset it falls back to `PROCESS/default.json`. **A missing recording is `exit 1` naming the path
it looked for** — never a silent empty response, which would make an unreachable fixture look
like a passing one.

Selection is by fixture id and **not** by hashing the input, because `commit-msg-draft` declares
`inputs: []` — every one of its fixtures has the identical input `{}`, so an input hash would
collide across all five and hand the same recorded response to every one of them. The varying
thing is the repo state (M3), which the input never sees.

**M3 · What a synthetic repo state is.** A directory
`tests/fixtures/engine/evals/commit-msg-draft/repo-states/FIXTURE-ID/` holding two trees:
`base/` (the committed starting point) and `work/` (the uncommitted changes the process must
find). The harness: `mkdtemp` → copy `base/` → `git init` → **set `user.name`/`user.email` as
repo-local config, never via env** (a subshell-scoped `GIT_AUTHOR_*` passes locally and fails 128
on a clean CI runner) → `git add -A` and commit the base → **copy `work/` over the top and leave
it UNSTAGED** → export `ARC_ROOT` to that temp dir. The fixture JSON names its state by
`repo_state: "FIXTURE-ID"`. Temp dirs are removed on exit, including on failure.

**The harness deliberately does NOT stage.** `commit-msg-draft`'s whole job is *"Stage related
changes and write a conventional commit"* (M11) — it holds `git.op: add:*` and `commit:*`. A
harness that pre-staged would do the process's work for it and leave a clean-index repo in which
the model has nothing to decide, which is exactly the fixture-that-measures-nothing failure this
phase exists to avoid. The harness builds the situation; the process acts on it.

**M4 · Assertion `path` syntax.** Dot notation with numeric indices only — `commits.0.subject`.
No JSONPath, no wildcards, no filters. A path that does not resolve makes the assertion **FAIL**
(not error); `absent` is the op that asserts a path is missing.

**M5 · Value shape per op.** `length_between` takes `"value": [MIN, MAX]`, inclusive, both
integers. `equals`, `matches` and `contains` take a scalar. **`absent` takes NO `value` key at
all**, and the registry refuses an `absent` assertion that carries one — a value there means the
author expected something other than "this path must not exist". The registry validates the
value shape per op and **refuses** a mismatch rather than coercing it.

**M6 · How bench emits.** The same way `arc-run` does (`arc-run.mjs:250-265`):

```
bash .claude/scripts/hq/arc-event.sh emit run.completed --payload JSON --process bench@0.1.0 --outcome ok --strict
```

Bench never writes to `events/` itself. `--strict` is first-party (ADR-0031/0032).

**M7 · Test spine isolation is real, and verified.** `ARC_SPINE_ROOT` is honored by
`spine-io.mjs:41`, keyed on **presence, not truthiness** (`"ARC_SPINE_ROOT" in process.env`), so
an empty value still redirects rather than silently falling through to the real log. Every bench
bats file sets `export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"` in `setup()`, matching
`tests/engine-driver-contract.bats:23`.

**M8 · `common.mjs` is in scope.** It lives at `.claude/scripts/engine/drivers/common.mjs`,
inside the `.claude/scripts/engine/drivers/**` tree PLAN's touch-with-care rule already names.
The `version` verb dispatch at `common.mjs:152` is an authorized edit under ADR-0902's scope
fence. Nothing else in that file may change.

**M9 · How the negative control breaks the real path without touching production code.** The test
**copies `.claude/scripts/engine/drivers/` into `$BATS_TEST_TMPDIR`, patches the COPY** to throw
inside `produce()`, and runs the contract suite against the copy. No test-only seam is added to
shipped code — a production `if (process.env.ARC_TEST_BREAK)` branch would itself be a new
untested path, and the thing under test is precisely whether the fake reaches `produce()`.

**M10 · Regenerating the shard timing table.** `gh workflow run weigh-tests.yml`, then commit the
regenerated weights as a **named step**, confirming only intended paths moved. Unmeasured entries
are reported as a COUNT, never absorbed into the default.

**M11 · What the assertions actually run against — the harness's OUTPUT side.** `commit-msg-draft`
does not merely draft text: its intent is *"Stage related changes and write a conventional
commit"* and its declared tools include `git.op: add:*` and `commit:*`. So the process itself
stages and commits inside the materialized temp repo, and its output `{commits: [{sha, subject}]}`
**names real commits it just made there**. Assertions therefore run against **the driver's raw
output JSON** — nothing re-reads git afterwards, and bench never commits on the process's behalf.
The harness's job ends at setup (M3); the record is the output.

**M12 · Where the five fixture records live.** Five JSON files beside the existing one, at
`tests/fixtures/engine/evals/commit-msg-draft/NAME.json`, each listed in that process's `evals:`
list — the pattern already in the tree (`commit-msg-draft.process.yaml:36-37` lists one path
today). Each file carries `note`, `input` (`{}` — the process declares no inputs), `expected`,
`repo_state` and `assertions[]`. `pack.json` sits beside them holding only `revision` and
`task_class`.
**M13 · `arc-bench.mjs`'s own contract.** It lives at `.claude/scripts/engine/arc-bench.mjs`
(authorized path 4 in PLAN's touch-with-care list) and mirrors `arc-run.mjs`'s conventions: a
**closed flag set** — `--driver`, `--model`, `--budget`, `--champion`, `--propose`, `--dry-run` —
and `exit 2` naming any unknown option. Exit codes: **0** the run completed and every selected
fixture was scored · **1** the run completed but at least one class is `partial` or
budget-aborted · **2** operator error (bad flag, unknown driver, unreadable fixture). Phase 0
asserts only exit 0 on the happy path and exit 2 on an unknown flag; the `partial` path arrives
with Phase 1's admission control. The printed scorecard's exact layout is an implementation
choice this phase — **no test asserts its shape**, because pinning a human-readable table before
the numbers exist would freeze the wrong thing. The machine-readable manifest, which IS pinned,
is Phase 2 (ADR-0907).

**A clarification the round-2 gate was right to demand:** `TOP_LEVEL_KEYS`
(`process-lint.mjs:65-67`) governs the **process YAML's** top-level keys, NOT the fixture JSON's.
Fixture files are free-form apart from `expected`, which `arc-run.mjs:184-186` requires — so a
fixture may carry `assertions` and `repo_state` freely. The frozen key set is why the eval-pack
**revision** lives in a sibling `pack.json` rather than in the process YAML; it never constrained
the fixtures themselves.

## Exit criteria (Definition of Done)

- [ ] **`drivers/mock` exists** at `.claude/scripts/engine/drivers/mock.{mjs,sh}`, honours the
      ADR-0203 contract exactly (`run PROCESS INPUT-JSON BUDGET` → JSON on stdout, cost sidecar
      at `$ARC_DRIVER_COST_FILE`, exit `0`/`1`/`2`), replays pinned bytes per **M2**, and is
      registered in `arc-run.mjs`'s `DRIVERS` list so `--driver mock` routes. It reports version
      `mock@FIXTURE-DIR-SHA` so a replay run can never be read as a provider run.
- [ ] **The mock swaps the RESPONSE, never the code path** — proven, not asserted, by the **M9**
      negative control. It does **not** hold today: `common.mjs:180-191` returns inside the fake
      branch before `await produce()` ever runs, while `tests/engine-driver-contract.bats:6-8`
      claims the opposite. **Bench reports that engine defect and does not fix it.**
- [ ] **`version` verb** answered by `claude-code` and `mock` only (ADR-0902); `codex` and
      `generic-api` are out of scope. The dispatch edit is at `common.mjs:152` (**M8**).
- [ ] **The ADR-0905 assertion schema exists and is versioned from birth:**
      `tests/fixtures/engine/evals/CLASS/pack.json` = `{ "revision": "SEMVER", "task_class":
      "NAME" }`, and a fixture may carry `assertions: [{ "id": "A-01", "path": "...", "op":
      "...", "value": ... }]` with path syntax **M4** and value shapes **M5**. **The op set is
      closed:** `equals` · `matches` · `contains` · `absent` · `length_between`. The registry
      **refuses** any op outside it rather than skipping, and no op may call a model, read the
      clock or touch the network.
- [ ] **`process-lint.mjs` still validates all 3 processes unchanged** after the `pack.json`
      addition — **proven by running it**. `pack.json` is a sibling file precisely so the frozen
      `TOP_LEVEL_KEYS` (`process-lint.mjs:65-67`) is never touched. **`process-lint.mjs` itself**
      contains a literal control byte and so reads as binary to `grep` — use `grep -a` when
      searching that script.
- [ ] **The fixture-repo harness exists** per **M3**, because `commit-msg-draft` declares
      `inputs: []` and its real input is ambient git state. Five flat repo states is the whole
      scope; a general git-fixture framework is a declared rabbit hole.
- [ ] **`commit-msg-draft` armed to 5 fixtures** laid out per **M12** and each over a DISTINCT
      repo state, carrying real assertions against the driver's output `{commits: [{sha,
      subject}]}` per **M11** — `sha` matching `^[0-9a-f]{7,40}$`, `subject` matching a
      conventional-commit grammar pinned in the fixture itself. All 5 paths are added to the
      process's `evals:` list. A fixture with no `assertions` key contributes **0** to the
      assertion denominator and is never a pass.
- [ ] **`review-diff` and `kickoff-plan` read `NO PROPOSAL — evidence insufficient (1 of 5
      fixtures)`** from a **standalone MIN_FIXTURES=5 count check**, independent of Phase 2's
      eligibility engine, which does not exist yet. Without this, REQ-06 could be marked done at
      Phase-0 close with half its text never exercised.
- [ ] **Steel thread demonstrated end to end:** `arc-bench.mjs --driver mock --model MODEL
      --budget inr=10` discovers fixtures → materializes ONE fixture's repo state → invokes
      `arc-run` per **M1** → scores → emits one `run.completed` per **M6**. **The receipt is
      verified present in `events/` and absent from `events/_quarantine/`** — exit 0 from a
      fire-and-forget writer is not evidence anything was written.
- [ ] **The kickoff ADRs are VERIFIED here, not authored here.** ADR-0900..0914 were written at
      kickoff and are `accepted`. Phase 0 confirms all 15 files exist, that
      `node .claude/scripts/plan/kickoff-lint.mjs --lane bench` still exits 0, and that **no file
      outside `0900–0999` was written by this lane**. Phase 0 authors no ADR unless a finding
      contradicts one.
- [ ] **Cross-lane check performed and recorded** before the first commit touching **any of the
      five authorized paths**: `.claude/scripts/engine/drivers/**` ·
      `tests/fixtures/engine/evals/**` · `.claude/scripts/engine/arc-run.mjs` (one-line `DRIVERS`
      registration) · `.claude/scripts/engine/arc-bench.mjs` (new file) ·
      `processes/commit-msg-draft.process.yaml` (`evals:` list only, per PLAN § No-gos).
      `git log origin/main --oneline -5 -- PATH` for each, **output recorded to
      `initiatives/bench/evidence/phase-00/cross-lane-check.md`**. Engine is IDLE but leads,
      memory and scheduler are LIVE in sibling worktrees.
- [ ] tests added and **green on CI** (never run the suite on this box) —
      `.github/workflows/ci.yml`, read per JOB via `gh run view --json jobs`, never `gh run watch
      --exit-status`, which has already exited 0 on a run whose conclusion was `failure`. Confirm
      the run's head SHA is the local HEAD.
- [ ] every new test file asserts its own registered test count from `BATS_TEST_NAMES`, every
      `@test` name is ASCII-only, every file sets a throwaway `ARC_SPINE_ROOT` (**M7**), and the
      shard timing table is regenerated per **M10**
- [ ] tracker updated: the Phases-table row in `initiatives/bench/PROGRESS.md` flips to ✅, a
      dated line is appended to `## Done-log`, and `## Now` is rewritten. The machine header's
      `phase:` and `burn:` move in the same edit, because `PORTFOLIO.md` derives from it.

## Verification plan

- **Test command:** `bats tests/bench-driver-contract.bats` then `bats tests/bench-assertions.bats`
  — one file at a time, foreground; **CI is the gate** (`.claude/rules/testing.md`).
  `bench-driver-contract.bats` covers the mock's ADR-0203 conformance, the `version` verb, and the
  **M9** swap-the-response negative control; `bench-assertions.bats` covers the closed op set, the
  refuse-unknown-op case, the zero-denominator rule, and the MIN_FIXTURES count check.
- **Expected failure first:**
  `bats tests/bench-driver-contract.bats` fails on its first case,
  `@test "mock satisfies the ADR-0203 driver contract"`, with
  `bash: .claude/scripts/engine/drivers/mock.sh: No such file or directory` and status `127` —
  the mock does not exist yet.
  **The second red is the one that matters:** `@test "breaking the real driver path turns this
  suite red"` patches a COPY of the driver tree to throw inside `produce()` and asserts the
  contract suite REJECTS the run. **It fails today and must keep failing until the mock is built
  correctly** — because a fake that returns before `produce()` runs (exactly what
  `ARC_DRIVER_FAKE` does at `common.mjs:180-191`) leaves the suite GREEN. That is the whole point
  of the control: a mock that short-circuits produces a green suite and therefore a red test, so
  it cannot pass vacuously.
  **Third red:** `@test "an assertion op outside the closed set is refused, not skipped"` feeds
  `op: "regex"` — a plausible near-miss for `matches` — and asserts the scorer REFUSES it naming
  the op and the fixture id. A scorer that silently skipped an unknown op would report 100%
  assertion pass-rate on a fixture that checked nothing.
  **Fourth red:** `@test "a fixture with no assertions contributes 0 to the denominator"` asserts
  the reported assertion pass-rate is **absent**, not `100%`. Treating "no assertions" as "all
  passed" is the compliant-characterless-work failure from retro-log 2026-07-30.
- **Live demo scenario:** (1) `bash .claude/scripts/engine/drivers/mock.sh version` → prints
  `mock@SHA`, exit 0. (2) `node .claude/scripts/engine/arc-bench.mjs --driver mock --model
  fixture/replay --budget inr=10` → scorecard printed, one fixture scored, exit 0. (3) `ls
  .claude/state/hq/events/` and `ls .claude/state/hq/events/_quarantine/` → the receipt is in the
  first and not the second. (4) `node .claude/scripts/engine/process-lint.mjs --all` → exit 0.
  (5) run with `--propose` → `review-diff` and `kickoff-plan` print `NO PROPOSAL — evidence
  insufficient (1 of 5 fixtures)`.
- **Real-system check:** the harness runs against the **real committed** `commit-msg-draft`
  process and the real `engine/router.yaml`, read as they exist — never described from PLAN prose
  about them. A discrepancy between this spec and a file is a finding, and the file wins. No
  provider is called this phase: `--driver mock` only, ₹0.
- **Expected evidence:** CI job output for both bats files with their asserted test counts · the
  5 armed fixtures, their `repo-states/` dirs and `pack.json` · the mock's `version` output · the
  two `events/` vs `_quarantine/` listings · `process-lint --all` exit 0 · the recorded
  `git log origin/main` cross-lane check for both engine-owned trees.

## Pre-planned cuts, in order — decided now, not at 6pm on day 3

1. **The `NO PROPOSAL` count check** narrows from a full `--propose` run to a unit test over the
   count function. The rule still ships; only the demo path shrinks.
2. **The armed fixtures' repo states** simplify from 5 rich scenarios to 5 distinct single-file
   diffs. Five states that DIFFER is the requirement; how rich they are is not.
3. **The mock's `version`** drops from a fixture-dir sha to a constant string. The real/simulated
   distinction survives; only its precision drops.

**Never cut:** the mock existing and satisfying ADR-0203 · the M9 negative control · the closed op
set refusing unknown ops · the receipt landing check. Those four are the phase; if they cannot be
reached inside the appetite, that is the kill criterion working.

## Rabbit holes in this phase

- **Fixing `ARC_DRIVER_FAKE` for all three drivers.** Bench proves the defect exists and builds
  `mock` correctly. Repairing engine's fake is engine's work — report it, do not adopt it.
- **A general git-fixture framework.** Five flat repo states in a temp dir. No inheritance, no
  templating, no DSL.
- **Making the assertion language expressive.** Five ops, closed. A sixth needs an ADR amendment,
  not a commit.

## Out of scope for this phase

The full multi-process run, K=3, admission control and the replay proof (Phase 1) · the proposal
artifacts and gates-first eligibility (Phase 2) · drift, baselines and the real event (Phase 3) ·
the mutants and the redaction sweep (Phase 4).

## Your-setup / pending

Nothing. No keys, no accounts, no network, no spend — this phase runs on `--driver mock` only.

## Non-negotiables (verbatim from PLAN)

- Propose-only: a human merges every routing change, and bench has no write path to the router — the router SHA is asserted unchanged after every run including aborts, and the guard is a parse plus a running mutant, never a grep. The policy-bypass guard is held to the identical standard, a parse plus a running mutant, because a driver spawn hides behind `child_process` and async exec exactly as a file write hides behind `fs/promises`.
- Fixtures are the eval packs processes ship; bench strengthens them in place and never forks a bench-only copy.
- Deterministic checks only: no LLM judges, and no assertion op may call a model, read the clock or touch the network.
- One candidate driver+model pair per run, driver named explicitly; no tournaments, no sweeps.
- Per-task-class verdicts only, never one collapsed average across processes.
- Schema pass-rate and assertion pass-rate stay separate; an absent denominator reports absent rather than 100%; and K attempts are never collapsed into one per-fixture verdict.
- A partial run never emits a proposal: it is flagged `partial`, and its affected classes read `NO PROPOSAL` carrying the reason.
- One failed fixture never erases the rest of a run's evidence, and a gate that short-circuits the proposal never skips the independent checks bundled after it.
- Budget is a property of the RUN: one remainder threaded through every attempt, retry and fallback hop, and exhaustion is terminal and never triggers the fallback path.
- Sequential fixture execution in v1.
- Absent data stays absent: never estimated, never zero, never a placeholder, and a spend ceiling never appears in any emitted payload.
- The canonical encoder is total and type-tagged: it REFUSES `undefined`, `NaN`, `±Infinity`, `BigInt` and cycles rather than coercing them, and absent fields are absent keys rather than `null`.
- Zero new spine kinds; first-party `--strict` emits; after every emit, look in both `events/` and `events/_quarantine/` and confirm where the receipt landed.
- Bench introduces no policy subject and never spawns a driver outside the policy gate.
- Human-started runs only; a clean guard run leaves no open approval on the spine.
- Real and simulated never mix: the mock driver reports its own version and swaps the response, never the code path.
- Secret redaction verified on every stored bench artifact.
- Offline-first: bench's own tests run against `drivers/mock` at ₹0 and against a throwaway `ARC_SPINE_ROOT`, never the real event log; tests stay centralised in `tests/` (ADR-0021), every `@test` name is ASCII-only, and every test file asserts its own registered test count — enforced by a CI step that diffs the declared count against bats' executed count and fails the job on a mismatch, not by author diligence.
- Before editing `.claude/scripts/engine/drivers/**`, `tests/fixtures/engine/evals/**` or any shared company organ, run `git log origin/main --oneline -5 -- PATH` per `.claude/rules/lanes.md`; a touched-since-branch-point result is resolved now, not at merge.
- Adding test files reshuffles the bats shard plan: regenerate the timing table as a named step and make unmeasured entries visible as a count, never absorbed into a default.
- A gate, lint or parser is not done until TWO fresh adversarial agents with different surfaces have attacked it, the pass attacks the TEST that protects the rule not only the rule, and each attacker's prompt carries the lane's running list of already-fixed defects with the instruction to check each one in every OTHER file — a fix is not applied until it has been attacked somewhere it was never made.
- CI is the gate, read per JOB via `gh run view --json jobs`; never trust a watcher's exit code.
- Mid-cycle changes go through `/arc-change --lane bench`, never ad-hoc.
