# Build Brief — phase 00 · the road + steel thread

spec-hash: sha256:e5b1aebda150c39ae65b936000cb69b8b82f8de8cbb3f857f0ea3332f32cc6cc
lane: bench
reqs: 
adrs: 0021, 0031, 0203, 0900, 0902, 0905, 0907
blast-radius: .claude/rules/lanes.md, .claude/rules/testing.md, .claude/scripts/engine/arc-bench.mjs, .claude/scripts/engine/arc-run.mjs, .claude/scripts/engine/drivers/, .claude/scripts/engine/drivers/**, .claude/scripts/engine/drivers/common.mjs, .claude/scripts/engine/drivers/mock.{mjs,sh}, .github/workflows/ci.yml, PORTFOLIO.md, engine/router.yaml, initiatives/bench/PROGRESS.md, initiatives/bench/evidence/phase-00/cross-lane-check.md, processes/commit-msg-draft.process.yaml, tests/, tests/engine-driver-contract.bats:23, tests/engine-driver-contract.bats:6-8, tests/fixtures/bench/mock-replay/, tests/fixtures/engine/evals/**, tests/fixtures/engine/evals/CLASS/pack.json, tests/fixtures/engine/evals/commit-msg-draft/NAME.json, tests/fixtures/engine/evals/commit-msg-draft/repo-states/FIXTURE-ID/
no-gos: 
blast-radius-dropped: 30

### Non-negotiables

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

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: **`drivers/mock` exists** at `.claude/scripts/engine/drivers/mock.{mjs,sh}`, honours the ADR-0203 contract exactly (`run PROCESS INPUT-JSON BUDGET` → JSON on stdout, cost sidecar at `$ARC_DRIVER_COST_FILE`, exit `0`/`1`/`2`), replays pinned bytes per **M2**, and is registered in `arc-run.mjs`'s `DRIVERS` list so `--driver mock` routes. It reports version `mock@FIXTURE-DIR-SHA` so a replay run can never be read as a provider run.
kind: logic
risk: high
proof: bats tests/bench-driver-contract.bats -- 4/4 green; RED first at exit 127 (mock.sh absent)
tier: contract
sources: phase-00-spec.md, code:grep-fallback(1326; no .codegraph/), adrs(18), learning(3), retro(21), churn(744)
decision: Reuse runDriver so mock IS a produce() and runs the whole real path, swapping only the response -- the opposite of ARC_DRIVER_FAKE, which returns before produce() (common.mjs:180-191). Select the recording by ARC_MOCK_FIXTURE, never by input hash: commit-msg-draft declares inputs: [] so all five fixtures share the input {} and a hash would collide across every one. Cost stays ABSENT rather than zero (no provider was called). Recording path confined to ARC_MOCK_DIR against a .. in processName or the fixture id.
result: ok 1 mock satisfies the ADR-0203 driver contract on a recorded process / ok 2 mock exits 1 and names the path when its recording is missing / ok 3 arc-run routes --driver mock / ok 4 this file registers the number of tests it declares. Manual verify: arc-run --driver mock emitted run.completed to a throwaway ARC_SPINE_ROOT, present in events/, absent from _quarantine/. FINDING: that receipt reads model=unpinned, because arc-run.mjs:518 takes the model from router.yaml and ignores the driver -- so mock and a real unpinned driver are indistinguishable on arc-run receipts. Bench carries the truth in its own subject block (ADR-0903); widening arc-run is outside the scope fence.
commit: 6b537de

#### slice: 02

title: **The mock swaps the RESPONSE, never the code path** — proven, not asserted, by the **M9** negative control. It does **not** hold today: `common.mjs:180-191` returns inside the fake branch before `await produce()` ever runs, while `tests/engine-driver-contract.bats:6-8` claims the opposite. **Bench reports that engine defect and does not fix it.**
kind: logic
risk: medium
proof: bats tests/bench-driver-contract.bats -- 7/7 green (3 new); test 4 RED first on a wrong premise, see decision
tier: contract
sources: phase-00-spec.md, code:grep-fallback(1330; no .codegraph/), adrs(18), learning(3), retro(23), churn(749)
decision: Prove it by DISCRIMINATION, not by patching. M9 proposed copying drivers/ to tmp and patching the copy to throw inside produce(); that needs an in-place edit, and sed -i is a GNU-ism BSD sed reads as a backup suffix (retro-log 2026-08-03 killed the macOS leg once), while a copied tree only proves things about the copy. Instead: an empty recording dir makes mock exit 1, and only code inside mock produce() can raise that; the SAME empty dir plus ARC_DRIVER_FAKE flips it to exit 0 because common.mjs:180-191 returns before produce runs. That pair is the control, and it patches nothing. The fake test is a CANARY -- if engine repairs the short-circuit it goes red, and that red is the good news.
result: ok 4 mock runs the shared budget path, so an unparseable budget fails before any replay / ok 5 mock reaches produce: an empty recording dir fails the run / ok 6 ARC_DRIVER_FAKE does NOT reach produce -- the engine defect this driver exists to avoid. Test 4 first asserted foo=1 would fail; it does not, because parseBudget accepts ANY lowercase key (common.mjs:37) and the closed inr/min set is enforced a layer up at arc-run.mjs:128. The test had been asserting a rule that lives elsewhere -- fixed to an unparseable value (inr=abc).
commit: da0d888

#### slice: 03

title: **`version` verb** answered by `claude-code` and `mock` only (ADR-0902); `codex` and `generic-api` are out of scope. The dispatch edit is at `common.mjs:152` (**M8**).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **The ADR-0905 assertion schema exists and is versioned from birth:** `tests/fixtures/engine/evals/CLASS/pack.json` = `{ "revision": "SEMVER", "task_class": "NAME" }`, and a fixture may carry `assertions: [{ "id": "A-01", "path": "...", "op": "...", "value": ... }]` with path syntax **M4** and value shapes **M5**. **The op set is closed:** `equals` · `matches` · `contains` · `absent` · `length_between`. The registry **refuses** any op outside it rather than skipping, and no op may call a model, read the clock or touch the network.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **`process-lint.mjs` still validates all 3 processes unchanged** after the `pack.json` addition — **proven by running it**. `pack.json` is a sibling file precisely so the frozen `TOP_LEVEL_KEYS` (`process-lint.mjs:65-67`) is never touched. **`process-lint.mjs` itself** contains a literal control byte and so reads as binary to `grep` — use `grep -a` when searching that script.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **The fixture-repo harness exists** per **M3**, because `commit-msg-draft` declares `inputs: []` and its real input is ambient git state. Five flat repo states is the whole scope; a general git-fixture framework is a declared rabbit hole.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **`commit-msg-draft` armed to 5 fixtures** laid out per **M12** and each over a DISTINCT repo state, carrying real assertions against the driver's output `{commits: [{sha, subject}]}` per **M11** — `sha` matching `^[0-9a-f]{7,40}$`, `subject` matching a conventional-commit grammar pinned in the fixture itself. All 5 paths are added to the process's `evals:` list. A fixture with no `assertions` key contributes **0** to the assertion denominator and is never a pass.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **`review-diff` and `kickoff-plan` read `NO PROPOSAL — evidence insufficient (1 of 5 fixtures)`** from a **standalone MIN_FIXTURES=5 count check**, independent of Phase 2's eligibility engine, which does not exist yet. Without this, REQ-06 could be marked done at Phase-0 close with half its text never exercised.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **Steel thread demonstrated end to end:** `arc-bench.mjs --driver mock --model MODEL --budget inr=10` discovers fixtures → materializes ONE fixture's repo state → invokes `arc-run` per **M1** → scores → emits one `run.completed` per **M6**. **The receipt is verified present in `events/` and absent from `events/_quarantine/`** — exit 0 from a fire-and-forget writer is not evidence anything was written.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: **The kickoff ADRs are VERIFIED here, not authored here.** ADR-0900..0914 were written at kickoff and are `accepted`. Phase 0 confirms all 15 files exist, that `node .claude/scripts/plan/kickoff-lint.mjs --lane bench` still exits 0, and that **no file outside `0900–0999` was written by this lane**. Phase 0 authors no ADR unless a finding contradicts one.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: **Cross-lane check performed and recorded** before the first commit touching **any of the five authorized paths**: `.claude/scripts/engine/drivers/**` · `tests/fixtures/engine/evals/**` · `.claude/scripts/engine/arc-run.mjs` (one-line `DRIVERS` registration) · `.claude/scripts/engine/arc-bench.mjs` (new file) · `processes/commit-msg-draft.process.yaml` (`evals:` list only, per PLAN § No-gos). `git log origin/main --oneline -5 -- PATH` for each, **output recorded to `initiatives/bench/evidence/phase-00/cross-lane-check.md`**. Engine is IDLE but leads, memory and scheduler are LIVE in sibling worktrees.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: tests added and **green on CI** (never run the suite on this box) — `.github/workflows/ci.yml`, read per JOB via `gh run view --json jobs`, never `gh run watch --exit-status`, which has already exited 0 on a run whose conclusion was `failure`. Confirm the run's head SHA is the local HEAD.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: every new test file asserts its own registered test count from `BATS_TEST_NAMES`, every `@test` name is ASCII-only, every file sets a throwaway `ARC_SPINE_ROOT` (**M7**), and the shard timing table is regenerated per **M10**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: tracker updated: the Phases-table row in `initiatives/bench/PROGRESS.md` flips to ✅, a dated line is appended to `## Done-log`, and `## Now` is rewritten. The machine header's `phase:` and `burn:` move in the same edit, because `PORTFOLIO.md` derives from it.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
