# Phase 02 — router proposal

**Goal (one line):** turn a scorecard into a reviewable proposal — three artifacts, gates-first
eligibility, and a diff bench can never apply itself.
**Appetite:** 0.75 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] **Three artifacts per `--propose` run** (ADR-0907), under `initiatives/bench/evidence/`:
      human evidence table per task class · machine-readable results manifest · **stable unified
      diff pinned to the exact router SHA the run read**. Stable means same inputs → byte-identical
      diff, fixed key order, no timestamps in the diff body.
- [ ] **Gates-first eligibility** (ADR-0906), all six gates, in order: completeness · no schema
      regression · assertion ≥ champion − 2pp · coverage ≥ MIN_FIXTURES(5) per class · cost
      source eligible and comparable · same eval-pack revision as champion.
- [ ] **`NO PROPOSAL` always carries its reason**, and "evidence insufficient (1 of 5 fixtures)"
      and "candidate lost on assertions (−7pp)" never render identically.
- [ ] **A class at `NO PROPOSAL` produces artifacts 1 and 2 and NO diff at all** — never an
      empty or commented-out diff, which would read as a blank proposal.
- [ ] **A gate that short-circuits the proposal never skips the independent checks after it** —
      secret redaction, partial-failure evidence preservation and the router-SHA assertion all
      still run to completion on the early-exit path.
- [ ] **Bench has no write path to the router:** `sha256` of `engine/router.yaml` asserted
      unchanged after every run **including aborted ones**, and the SHA read at run-start is
      **re-read at proposal-emit** — a mismatch aborts with its own distinct reason rather than
      emitting a diff against a moved target.
- [ ] **`approval.requested` with gate `router-merge`** emitted for a real proposal, verified
      landed in `events/` and not `_quarantine/`.
- [ ] **The table and the manifest agree** on every recommendation — pinned by a test.
- [ ] tests added and green on CI, read per JOB; test counts asserted; `@test` names ASCII-only
- [ ] tracker updated: PROGRESS row ✅, done-log line, `## Now` rewritten, machine header moved

## Verification plan

Coarse at kickoff, refined via `/arc-change --lane bench` when the phase starts: prove the diff
is stable and review-only, prove every gate can independently produce `NO PROPOSAL` with a
distinguishable reason, and prove the router is byte-unchanged after a run that aborts midway.

## Rabbit holes in this phase

- **Report and diff UI polish.** The evidence table IS the interface.
- **Making the diff auto-appliable.** Explicitly a no-go; it is a review artifact.

## Out of scope for this phase

Drift, baselines and the real event (Phase 3) · the mutants and redaction sweep (Phase 4).

## Your-setup / pending

Nothing.

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
