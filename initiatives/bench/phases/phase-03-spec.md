# Phase 03 — drift guard + the real event

**Goal (one line):** catch a silently drifting champion on two independent axes, and prove the
whole loop once on a real model with a real human verdict.
**Appetite:** 1.0 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] **`--champion` re-runs current champions** and compares on **two split axes** (ADR-0908):
      quality-comparability (fixture/eval revision · process version · driver version · model id
      · request settings) and cost-comparability (token usage + comparable cost source).
- [ ] **Every cost delta is classified** into exactly one of: provider-rate change ·
      token-use/output-length change · unknown/mixed. A price rise is never reported as a usage
      change, and never hidden behind an incompatible baseline.
- [ ] **Three alert tiers, each proven by its own fixture:** (1) a new schema failure in a
      previously-clean champion → inbox item · (2) assertion drop ≥ 10pp AND ≥ 2 fixtures fail →
      inbox item · (3) cost increase > 20% → **REPORT-ONLY**, never an inbox item.
- [ ] **Alerts fire only where the class ships ≥ 5 fixtures**, so this cycle they are live for
      `commit-msg-draft` only — and **every report states which classes are muted and why**.
- [ ] **Baseline re-pin causes are enumerated and closed:** a quality-compatibility component
      changed, OR a routing change was merged. **The receipt names the compatibility-breaking
      cause, and a score movement alone NEVER re-pins** (the anti-goalpost clause).
- [ ] **REQ-05 preflight recorded before the real run:** the candidate is new to arc · reachable
      through an existing driver · access verified.
- [ ] **The candidate is proven REACHED** — a receipt carrying a real model id and a non-zero
      token count — **before any verdict is recorded**. "The run completed" and "the candidate
      was called" are different facts (retro-log 2026-08-03).
- [ ] **ONE real model benched end to end** (ADR-0914: a second model id under `claude-code`,
      not the class champion) → proposal → **human MERGED or REJECTED** via
      `arc-inbox VERDICT ULID --reason` producing `decision.recorded`. **Both outcomes are
      success.** The owner command carries its `cd` to the main clone, because the canonical
      spine is gitignored and each worktree has its own.
- [ ] **The guard cadence is monthly, first working day, owner-started (ADR-0910)**, and **a
      clean guard run emits ONLY `run.completed`** — no approval event exists for a no-drift
      run, because the spine never carries no-op approvals. `approval.requested` is created only
      by a drift finding (gate `drift`) or a router proposal (gate `router-merge`).
- [ ] **The guard's NEXT-CHECK date is written into `PROGRESS.md`** — absence is never inferred
      from nobody having looked.
- [ ] tests added and green on CI, read per JOB; test counts asserted; `@test` names ASCII-only
- [ ] tracker updated: PROGRESS row ✅, done-log line, `## Now` rewritten, machine header moved

## Verification plan

Coarse at kickoff, refined via `/arc-change --lane bench` when the phase starts: drive each
alert tier from its own fixture and assert the tier that fired, prove a score movement alone
does not re-pin a baseline, and capture the real event's full chain — run, proposal, approval,
verdict — read back off the spine rather than from the session's own memory.

## Rabbit holes in this phase

- **Latency micro-benchmarking.** Network jitter is not model speed; p95 is tiebreak-only.
- **Tuning the thresholds before any false alert exists.** 10pp / 2 fixtures / 20% are the
  recorded defaults; recalibration needs a real incident, by amendment.

## Out of scope for this phase

The mutants, the redaction sweep, the runbook and the retro (Phase 4).

## Your-setup / pending

**This phase spends real money.** It needs the `claude-code` CLI authenticated and a second
model id reachable under it. The human verdict at the end is an owner keystroke that no agent
may perform.

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
