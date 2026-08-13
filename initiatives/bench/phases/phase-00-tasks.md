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
proof: bats tests/bench-driver-contract.bats -- 11/11 green (tests 7-9 RED first); bats tests/engine-driver-contract.bats -- 1..20, NOT-OK COUNT 0
tier: contract
sources: phase-00-spec.md
decision: Make the verb OPT-IN: runDriver takes an optional version provider, and a driver that passes none keeps the original refusal byte-for-byte. That scopes it to claude-code and mock (ADR-0902) without a per-driver allowlist, and a test asserts codex and generic-api STILL reject it so it cannot spread by drift. A driver version is WHAT WOULD CHANGE ITS OUTPUT: claude-code@1.0.0 is its own adapter code, mock@sha is its recording set (the recordings decide mock output; the code only reads them), and a test asserts the mock version MOVES when the recordings move. Deliberately not the provider CLI version -- which model answered is MP-F fingerprint territory, and shelling out to claude --version would make an offline provenance field depend on a binary no CI leg installs.
result: ok 7 mock answers the version verb with its recording-dir identity / ok 8 mock version changes when the recordings change / ok 9 claude-code answers the version verb / ok 10 codex and generic-api still reject every verb but run. common.mjs is shared, so the engine contract suite is the regression surface: 20 tests, 0 failures. Sync golden regenerated as a named step with the delta checked first -- 3 files moved, 0 added, 0 removed; product-lint clean.
commit: 650cf47

#### slice: 04

title: **The ADR-0905 assertion schema exists and is versioned from birth:** `tests/fixtures/engine/evals/CLASS/pack.json` = `{ "revision": "SEMVER", "task_class": "NAME" }`, and a fixture may carry `assertions: [{ "id": "A-01", "path": "...", "op": "...", "value": ... }]` with path syntax **M4** and value shapes **M5**. **The op set is closed:** `equals` · `matches` · `contains` · `absent` · `length_between`. The registry **refuses** any op outside it rather than skipping, and no op may call a model, read the clock or touch the network.
kind: logic
risk: medium
proof: CI run 31599742774 -- 19/19 green, per-JOB, incl. bats tests/bench-assertions.bats; node tests/bench-assertions-probe.mjs -- 28 checks, exit 0
tier: unit
sources: phase-00-spec.md
decision: Land the substrate in arc-bench.mjs as importable pure functions so scoring is testable without spawning anything. Closed op set enforced at a REGISTRY rather than trusted to fixture authors, and an unknown op is REFUSED not skipped -- regex is the plausible near-miss for matches, and a skipped op reports a perfect rate on a fixture that checked nothing. Value shape validated per op: absent takes NO value, length_between takes two ordered ints, matches must compile. Paths are dot notation with numeric indices only; a path language grows into an expression language, and an expression language in a fixture is a program nobody reviews. readPack refuses a missing revision rather than defaulting it, because the revision is what makes champion and candidate comparable (BEN-A gate 6). Checks live in their own .mjs probe, not inline in bats, because they need apostrophes, backticks and $ -- CLAUDE.md forbids all three in a shell-embedded program.
result: 28 probe checks held, exit 0; CI green 19/19 on 5c00094 with the bats wrapper running the probe. The zero-denominator rule is pinned by its own test: a fixture with no assertions contributes 0 and reports rate ABSENT, never 100% (retro-log 2026-07-30 -- a pass condition that is only an absence cannot detect mediocrity). Placement recorded not assumed: arc-bench.mjs sits in the ENGINE product manifest per ADR-0901, so it ships to engine consumers; a products/bench/ split is a later decision. Sync golden regenerated last, 270 -> 271 rows, only arc-bench.mjs moved.
commit: 5c00094

#### slice: 05

title: **`process-lint.mjs` still validates all 3 processes unchanged** after the `pack.json` addition — **proven by running it**. `pack.json` is a sibling file precisely so the frozen `TOP_LEVEL_KEYS` (`process-lint.mjs:65-67`) is never touched. **`process-lint.mjs` itself** contains a literal control byte and so reads as binary to `grep` — use `grep -a` when searching that script.
kind: logic
risk: medium
proof: node .claude/scripts/engine/process-lint.mjs --all -- all checks passed (3 file(s)), exit 0; pinned as a regression test in tests/bench-assertions.bats; CI 19/19 per-JOB on 27f35ca (run for cc8bec1 also 19/19)
tier: contract
sources: phase-00-spec.md
decision: RUN the lint rather than trust the No-go sentence that claims the schema is additive. retro-log 2026-08-02: twice in one cycle a control the process had already decided on turned out not to exist, and both were found by running the artifact rather than reading it. The reason it passes is pinned too -- process-lint contains ZERO references to pack.json, because the manifest is a sibling of the fixtures precisely so the frozen TOP_LEVEL_KEYS never grows a key. The schema is additive because it lives outside the schema it would otherwise have had to change. The guard asserts the lint RAN and reached its verdict (all checks passed, 3 file(s)), never merely that it printed no error -- that shape is satisfied by a crash.
result: process-lint: all checks passed (3 file(s)), exit 0. Regression test added to tests/bench-assertions.bats (now 6 tests). Note for future searches: process-lint.mjs carries a literal control byte, so grep reads it as binary and silently matches nothing without -a -- itself a retro-log entry (2026-08-09), from the file that guards against control characters. Landed via a clean cherry-pick onto main as 27f35ca after the original branch accumulated a squash-merge conflict against every prior merge.
commit: 27f35ca

#### slice: 06

title: **The fixture-repo harness exists** per **M3**, because `commit-msg-draft` declares `inputs: []` and its real input is ambient git state. Five flat repo states is the whole scope; a general git-fixture framework is a declared rabbit hole.
kind: logic
risk: medium
proof: node tests/bench-harness-probe.mjs -- 19 checks, exit 0 (read WITHOUT a pipe); bats tests/bench-harness.bats 7 tests; CI 19/19 per-JOB on 29c3066, main verified on 7b00a63
tier: contract
sources: phase-00-spec.md
decision: A state is base/ (committed) plus work/ (uncommitted), and the harness DOES NOT STAGE -- staging is the process own declared job (git.op add/commit), and a pre-staged index leaves the model nothing to decide. Identity is repo-local config, never GIT_AUTHOR_* in the env, which passes on a box with a global identity and fails 128 on a clean runner. Deletions need a tombstone because copying cannot remove a file. The M9 negative control is proved by DISCRIMINATION rather than by patching a copied tree: sed -i is a GNU-ism BSD sed reads as a backup suffix, and a copied tree only proves things about the copy.
result: A real bug the test caught: repoStatus first did .trim() on git porcelain, and column 1 is the INDEX while column 2 is the WORKTREE -- so an unstaged ` M path` became `M path`, which reads as STAGED, and the one property this harness exists to guarantee silently could not be asserted. Now only the trailing newline is stripped. CI also went red on this slice: two new test files reshuffled the shard plan and exposed three unrelated scanner tests that pass only by shard luck. Root cause was measured, not guessed -- weigh-tests runs each file ALONE, and those three come back rc=1 in isolation on main AND on the branch, identically. Fixed by strengthening _arc_need_semgrep to probe the TOOL directly (the adapter ends its scan with || true, so a crashed scanner reads as a clean codebase) and by weighing every file: shard-timings 109 -> 115 entries.
commit: 29c3066

#### slice: 07

title: **`commit-msg-draft` armed to 5 fixtures** laid out per **M12** and each over a DISTINCT repo state, carrying real assertions against the driver's output `{commits: [{sha, subject}]}` per **M11** — `sha` matching `^[0-9a-f]{7,40}$`, `subject` matching a conventional-commit grammar pinned in the fixture itself. All 5 paths are added to the process's `evals:` list. A fixture with no `assertions` key contributes **0** to the assertion denominator and is never a pass.
kind: logic
risk: medium
proof: node tests/bench-armed-probe.mjs -- 49 checks, exit 0; node tests/bench-harness-probe.mjs -- 19 checks; CI 19/19 per-JOB on dbaa2c2, main verified on 9b843f6
tier: unit
sources: phase-00-spec.md
decision: Five DISTINCT repo states, not five inputs: commit-msg-draft declares inputs: [] so five fixtures sharing {} would be five samples of one case. Each state separates something specific -- an untracked file catches a draft that reads only git diff; a docs-only change catches a model that types everything feat; a deletion catches a draft built from added lines alone. Six assertions each: sha shape, conventional-commit grammar, the RIGHT type prefix, length 12-72, no trailing period, exactly one commit. NO new .bats file: the shard plan is computed from the file list, so a new file reshuffles it -- which is exactly what turned CI red on slice 06.
result: All five score 6/6 against their OWN expected -- the self-consistency check, without which a fixture could assert something nobody can pass and read as a permanent model failure. All five work trees verified to differ. CI went red once: engine-driver-contract REQ-06 builds a sandbox and copied only basic.json, while process-lint checks that EVERY declared eval path exists, so its clean-first assertion failed. That control did its job -- it exists precisely to stop a later failure being blamed on the wrong cause. Fixed at the root: the sandbox now copies the eval DIRECTORY, so adding a fixture can never break it again.
commit: dbaa2c2

#### slice: 08

title: **`review-diff` and `kickoff-plan` read `NO PROPOSAL — evidence insufficient (1 of 5 fixtures)`** from a **standalone MIN_FIXTURES=5 count check**, independent of Phase 2's eligibility engine, which does not exist yet. Without this, REQ-06 could be marked done at Phase-0 close with half its text never exercised.
kind: logic
risk: medium
proof: node tests/bench-armed-probe.mjs -- 61 checks, exit 0 (12 new); bats tests/bench-assertions.bats 12 tests
tier: unit
sources: phase-00-spec.md
decision: Count from the DECLARED evals list in the process YAML, never from a directory listing: a stray or half-added file beside the pack is not part of it, and counting the directory would let it lift a class over the floor without anything ever running it. The gate is deliberately standalone and does not reach for Phase 2 gates-first eligibility engine, which does not exist yet -- REQ-06 needs the other two classes to read NO PROPOSAL at Phase 0 CLOSE, and a criterion only a later phase could exercise would be marked done here without ever running (retro-log 2026-08-02, an exit criterion its own verifier could not check).
result: commit-msg-draft 6 declared fixtures -> ELIGIBLE, reason null. review-diff and kickoff-plan 1 each -> NO PROPOSAL - evidence insufficient (1 of 5 fixtures). The reason names both counts AND says WHY, so evidence-insufficient and candidate-lost never render identically (ADR-0906).
commit: f0a0cbd

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
