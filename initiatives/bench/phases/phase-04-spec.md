# Phase 04 — seal + retro

**Goal (one line):** attack the two guards that carry this lane's most important rules until
they provably reject a real mutant, verify nothing leaks, and close the cycle on counted
evidence rather than assertion.
**Appetite:** 1.0 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-03

## Exit criteria (Definition of Done)

- [ ] **System-level adversarial fixtures pass:** malformed eval output · unknown model ·
      missing cost · budget K-group boundary · nondeterministic key ordering.
- [ ] **The router-write mutant is REJECTED.** A mutant bench module that actually attempts to
      write `engine/router.yaml` — via `fs`, `fs/promises`, `child_process`, and async
      exec/spawn — is run, and the suite rejects it. The guard is a **parse plus a running
      mutant, never a grep**: retro-log 2026-08-04 records a grep-based propose-only guard that
      a mutant overwriting the canonical file, deleting the champion, committing and spawning a
      deploy walked straight past.
- [ ] **The policy-bypass mutant is REJECTED.** Bench adds no policy subject of its own
      (ADR-0912): every driver invocation resolves as `process:THE-PROCESS-BEING-BENCHED` and
      passes the same gate `arc-run` uses, so a runner that spawns a driver itself is an
      unpoliced spend path. A mutant bench that spawns `drivers/NAME.sh`
      directly, bypassing the policy gate, is run, and the suite rejects it. Held to the
      identical parse-plus-mutant standard, because a driver spawn hides behind `child_process`
      exactly as a file write hides behind `fs/promises`.
- [ ] **Each rejection is attributable to the specific guard under test** — a mutant that
      crashes on an unrelated fault (bad arg, missing env) before reaching its target behaviour
      is **NOT** a passing negative control, and the test asserts the recorded reason names the
      guard.
- [ ] **Two fresh adversarial surfaces**, not one generalist — one on the decision logic, one on
      the shell/OS boundary. Each attacker's prompt carries **this lane's running list of
      already-fixed defects** with the instruction to check each one in every OTHER file: a fix
      is not applied until it has been attacked somewhere it was never made.
- [ ] **Secret redaction verified on ALL stored bench artifacts** — scorecards, manifests,
      captured raw outputs, diffs — with a planted fake key proven absent from every one.
- [ ] **Partial-failure evidence preservation proven:** one failed fixture does not erase the
      rest of the run's evidence.
- [ ] **Runbook committed** naming the real command form (`node
      .claude/scripts/engine/arc-bench.mjs …`, ADR-0901), the monthly guard procedure, and what
      `NO PROPOSAL` means in each of its reasons.
- [ ] **Bench's PRODUCTION `run.completed` count is read from the spine and written into
      `PROGRESS.md`'s close entry by the closing session itself** — never inferred from CI, never
      from fixture counts. A cycle that adds machinery asserts its production count at close;
      policy's Cycle 9 shipped 4 kinds with 0 emissions and only the ledger could say so.
- [ ] **The guard's NEXT-CHECK date recorded**, and `/arc-retro` runs every count a trigger names
      before writing any assumption status; a dogfood-gated row is recorded NOT EVALUABLE rather
      than VALIDATED.
- [ ] **Retro answers: "did the eval packs discriminate?"** If not, the follow-up strengthens the
      OWNING process's evals, not bench.
- [ ] full suite green on CI, read per JOB via `gh run view --json jobs`
- [ ] tracker updated: PROGRESS row ✅, done-log line, `## Now` rewritten, machine header moved

## Verification plan

Coarse at kickoff, refined via `/arc-change --lane bench` when the phase starts: each mutant is
built to walk past its guard and the suite must reject it naming that guard; the redaction sweep
plants a fake key and greps every stored artifact class for it.

## Rabbit holes in this phase

- **Fixing every finding the adversarial pass returns.** Findings are triaged; CRITICALs block,
  the rest become recorded carried-forward holes with a named owner.
- **Growing the mutant corpus indefinitely.** Two mutants, each attacking a named rule.

## Out of scope for this phase

Anything that strengthens `review-diff` or `kickoff-plan` evals — that is the OWNING process's
work and the retro's recorded follow-up, not bench's.

## Your-setup / pending

The retro is a conversation with the owner. The close's spine query must be run from the main
clone, since the canonical spine is gitignored per worktree.

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
