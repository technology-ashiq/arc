# Phase 01 — bench core

**Goal (one line):** a full run across every fixture-shipping process, K=3 sequential, bounded
by admission control that reserves before it spends, producing a scorecard that replays
byte-identically.
**Appetite:** 1.5 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] **Full run across every fixture-shipping process** for ONE candidate driver+model pair,
      **sequentially** — no concurrency in v1, so no reservation-ledger races exist to solve.
- [ ] **K = 3 attempts per fixture, and the attempts are never collapsed.** Each of the K
      outcomes contributes individually to the assertion denominator; a 2-of-3 fixture and a
      1-of-3 fixture must not report as the same number. Medians reported **with their spread**.
- [ ] **Schema pass-rate and assertion pass-rate reported separately**, never merged, and
      assertion pass-rate reported **absent** (not 100%) where the denominator is 0.
- [ ] **K-group admission control** (ADR-0909): before a fixture starts, reserve
      **K × worst-case per-invocation spend** from `initiatives/bench/ceilings.json` against
      BOTH the run cap (₹500) and the process sub-cap (₹100). If the remainder cannot cover the
      whole group, the fixture is **NOT started** — `failure: budget`, evidence kept, class
      marked `NO PROPOSAL`.
- [ ] **Budget is a property of the RUN.** ONE remainder is threaded through every attempt,
      retry and fallback hop. **Exhaustion is its own terminal outcome and never triggers the
      retry or fallback path** — the exact defect retro-log 2026-08-03 records as having been
      true in the one place it was checked.
- [ ] **Post-call reconciliation**, including the overrun case: when a fixture's measured cost
      exceeds its reservation, the run remainder reflects the **real** spend and every later
      fixture is admitted or refused off the corrected remainder, never the stale reservation.
- [ ] **A ceiling value never appears in any emitted payload** (ADR-0904: a ceiling bounds
      spend, it never reports it) — not in `run.completed`, not in a scorecard cost column, not
      in a proposal row. Where a driver reports no cost, eligible cost is **absent**, never the
      ceiling and never zero. Negative-control fixture pins this.
- [ ] **The provenance tuple** (ADR-0913) recorded on every run, with `subject` (driver,
      driver_version, router_sha, eval_pack_revision, process_version, request_settings) as a
      block **beside** the MP-F `fingerprint` block, never inside it (ADR-0903). Absent fields
      are absent keys, never `null`, never `unknown`.
- [ ] **The canonical encoder is total and type-tagged**: it REFUSES `undefined`, `NaN`,
      `±Infinity`, `BigInt` and cycles rather than coercing them. The scorecard carries its
      **normalizer version**, so a format change reports stale-format and genuine mismatch as
      different outcomes with different exit codes.
- [ ] **Replay proof:** re-scoring captured outputs yields a **byte-identical** scorecard, green
      on all 3 CI OS legs.
- [ ] **One `run.completed`** per run with `process: bench@x.y.z` — an existing spine kind, zero
      new kinds added (ADR-0911) — emitted first-party `--strict` and verified present in
      `events/` and absent from `events/_quarantine/`. If any bench emit is ever rejected
      `UNKNOWN_KIND`, that is Assumption row 4 firing and ADR-0911's micro-vocab-ADR fallback is
      the recorded response, never an improvised kind.
- [ ] tests added and **green on CI**, read per JOB via `gh run view --json jobs`
- [ ] every new test file asserts its own registered test count; every `@test` name is ASCII-only
- [ ] tracker updated: PROGRESS row ✅, done-log line, `## Now` rewritten, machine header moved

## Verification plan

- **Test command:** `bats tests/bench-budget.bats` then `bats tests/bench-replay.bats` — one
  file at a time, foreground; CI is the gate. `bench-budget.bats` covers admission control, the
  overrun reconciliation, the terminal-exhaustion rule and the ceiling-never-emitted control;
  `bench-replay.bats` covers byte-identical re-scoring, the encoder refuse-cases and the
  normalizer-version split.
- **Expected failure first:**
  `bats tests/bench-budget.bats` fails on
  `@test "a group that cannot be covered never starts"` with
  `no such file: initiatives/bench/ceilings.json` — the ceiling file and the admission logic do
  not exist yet.
  **The red that matters most:** `@test "budget exhaustion does not trigger the fallback chain"`
  drives a run to cap exhaustion on a class whose `engine/router.yaml` row HAS a fallback list
  (`commit-msg-draft` falls back to `codex` then `generic-api`) and asserts the fallback drivers
  were **never invoked** and the receipt reads `reason: "budget"`. It must fail before the
  remainder is threaded, and it cannot pass vacuously because a run that never reached
  exhaustion would not produce the `budget` reason it asserts on.
  **Third red:** `@test "a measured cost above its reservation corrects the remainder"` asserts
  a LATER fixture is refused that would have been admitted off the stale reservation — the
  assertion is on the later fixture's refusal, so an implementation that reconciled nothing
  cannot pass it.
  **Fourth red, the encoder:** `@test "the canonical encoder refuses NaN rather than folding it
  to null"` asserts an explicit refusal and a distinct exit code. Under `JSON.stringify` this
  passes silently while producing a colliding hash — which is why the assertion is on the
  refusal, not on the hash.
- **Live demo scenario:** (1) run with `--budget inr=1` → the first group is refused, nothing is
  spent, the class reads `NO PROPOSAL`, exit non-zero with `reason: budget`. (2) run with
  `--budget inr=500 --driver mock` → full scorecard, all 3 classes scored, medians with spread.
  (3) re-score the captured outputs from (2) → `diff` of the two scorecards is empty.
  (4) corrupt one captured output's key order → the scorecard is still byte-identical (key order
  is normalized). (5) bump the normalizer version → replay reports **stale-format**, not tamper.
- **Real-system check:** the run reads the real `engine/router.yaml` and the real process files.
  Provider calls are `--driver mock` only this phase — ₹0 spent. The ceiling arithmetic is
  checked against the real `ceilings.json` values and the result recorded: if a full 3-class
  K=3 run does not fit ₹500, that is Assumption row 2 firing and it is written into PLAN, not
  absorbed.
- **Expected evidence:** CI job output for both bats files with asserted counts · the two
  scorecards from the replay demo plus their empty `diff` · the budget-refusal receipt showing
  `reason: "budget"` and no fallback invocation · the recorded ceiling arithmetic total.

## Rabbit holes in this phase

- **Statistical rigor.** K=3, medians, spread. A confidence interval is a later cycle's problem
  and needs a real false-alert incident to justify.
- **Making replay fast.** Byte-identical first. Nothing about speed is a Phase 1 requirement.
- **Parallel execution.** Declared out of scope; sequential v1 makes the whole race class moot.

## Out of scope for this phase

The three proposal artifacts and gates-first eligibility (Phase 2) · drift, baselines, the real
event (Phase 3) · the mutants and redaction sweep (Phase 4).

## Your-setup / pending

Nothing. `--driver mock` only; no credentials and no spend this phase.

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
