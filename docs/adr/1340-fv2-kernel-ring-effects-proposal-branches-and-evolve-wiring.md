# ADR 1340 — The kernel ring: effects past the spine, proposal branches, and evolve's measure/conclude wiring

**Status:** accepted
**Date:** 2026-09-19
**Product:** face (with additive changes in scheduler, engine, policy, evolve, absorb and bench, under ADR-1339)
**Reversibility:** two-way
**Revisit trigger:** an owning lane rejects one of the additive changes below → that verb becomes a residue row
(ADR-1339); a real client's primary metric is not 0/1 per unit → ADR-0306's own revisit trigger fires and
`conclude` gains a second metric family through an evolve ADR, never here; Node ships a job-object API → the
Windows process-tree debt row is paid (face debt ledger).
**Provenance:** the Phase 05 plan (ADR-1339) puts ten kernel verbs in PR 3: tier proposal, register job, open
experiment, bench propose, pin source, trial, driver switch, cap proposal, measure, conclude. The day-1 probe
(`initiatives/face/evidence/phase-05/cli-probe.md`) named their gaps. Building them found three questions that
PR 1's six never raised. This ADR answers them before the code, so the ring is not decided op by op.

## Context

PR 1's six ops all have one effect: a receipt on the spine. A sim door runs them against a fixture spine and the
effect lands there. The kernel ring breaks that assumption in three ways.

1. **Effects past the spine.** `register job` hands a task to the machine's scheduler. `driver switch` and
   `pin source` change files. A sim door that ran them would register a real task, or write a real branch, to
   rehearse something.
2. **File changes.** The Phase 05 exit criteria already say a file-touching op "writes only to a `feat/face-*`
   branch, shows the diff and stops; no merge exists". Nothing in arc yet writes a branch without checking it out.
   Checking out a branch in the owner's clone moves his working tree under him.
3. **Verbs whose library was never wired.** Evolve's `measure` and `conclude` exist only as library functions
   (`assign.mjs`, `verdict.mjs decide`). No CLI connects them to the spine or the module manifests. Wiring them
   means answering questions the evolve lane left open, above all what a "success" is.

## Decision

### 1. An effect past the spine is refused on a sim door at APPLY, and the plan still runs

A registry row that reaches past the spine declares it: `touchesOs: true` (the machine's scheduler) or
`touchesFiles: true` (a proposal branch). A sim door plans such an op normally. The plan is the tool's own dry run,
which writes nothing anywhere, so the plan path is exercised through the door. The door refuses the apply with
`SIM_EFFECT` (403) before anything runs, naming the effect. The one exception is a row that declares a `simSafe`
form, as `bench.run-model` already does for the mock driver.

`SIM_SPEND` stays as it is, refused at plan: a paid plan is still a paid thing to have asked for. A live door runs
every op. An op whose effect is on the machine or the repository is `humanRun`: it applies only on the owner's
click.

### 2. A file change is a proposal branch written by git plumbing, never a checkout

`.claude/scripts/core/proposal-branch.mjs` is the one writer. The owning lane's tool computes the file contents. The
library commits them to a NEW branch, `feat/face-<op>-<slug>`, like this:
- a temporary index (`GIT_INDEX_FILE`), with `read-tree` of the base
- `hash-object -w` for each blob, then `update-index --cacheinfo`
- `write-tree`, then `commit-tree` with a fixed machine identity
- `update-ref refs/heads/<branch> <commit> <zero>`: the all-zero old value makes the create atomic and refuses a
  branch that already exists

It never runs `checkout`, `switch`, `merge`, `push`, `reset`, `stash` or `rebase`. It never touches the working
tree, `HEAD`, the real index or `main`, and a fixture proves each one unchanged.

The base is `origin/main` when the clone tracks it, else local `main`: a clone's own main lags the owner's merges,
and a proposal against a stale main is a diff against a file that has already moved. A clone with neither (a CI
checkout of a PR ref) refuses with `NO_BASE`, by name. The plan computes the same diff with no object written: blobs are hashed without `-w` and
the diff comes from `git diff --no-index` over two temp files. The apply then raises `approval.requested` naming the
branch, and the tool prints its receipt. There is no merge path. A human merges, or does not.

### 3. The cap proposal is the promotion profile, and it writes no branch

The policy room's "cap proposal" is the probe's binding:
- `approval.requested` under the strict `policy.promotion` profile, built by `buildPromotionRequest`
- `policy_hash` from the current policy
- `trial_ledger_ref` as a citation

It raises a capability's level within its declared ceiling. Raising a ceiling is a human edit to `hq.policy.yaml`
(POL-A), and `hq.policy.yaml` is an un-grantable target (ADR-0502). No machine path writes it, a proposal branch
included. The Phase 05 exit criterion "driver switch, terminate and cap proposal write a `feat/face-*` branch" is
amended the same day: driver switch and terminate write one, and the cap proposal writes none. The fixture that
proves nothing in the face writes `hq.policy.yaml` covers the branch writer too.

### 4. Evolve's open, measure and conclude, wired to the spine

- **open**
  - `base_sha` is the sha256 of the target file's raw bytes: "the target's digest when the experiment opened".
  - The module must declare a valid `evolve` section. A module without one has no floor and no metrics, so it
    could never conclude.
  - The concurrency cap (ADR-0310, 2 per module) is checked against the experiments on the spine that are open.
- **measure**
  - The owner reports one unit's value for one metric and one window.
  - The CLI takes the arm and cohort from `assign()` over the opened experiment's arms and split. An existing
    `experiment.assigned` for that unit is the authority, and a disagreement refuses.
  - A closed experiment refuses. So does a verdicted one, and one whose target digest has moved (`sealBroken`:
    canonical drift).
- **conclude** computes `decide()` from the spine, over the **verdict cohort only**. The generation cohort is
  exploratory (ADR-0310).
  - Arms: the opened arms, exactly two, in declared order (champion first).
  - Per-arm floor: the manifest's `per_arm_floor`.
  - Alpha: 0.05.
  - Effect floor: the manifest's value, 0 by default (ADR-0310).
  - MDE: 0 unless the manifest declares one.
  - n per arm: the distinct units in the complete windows of the primary metric (`board.countPerArm`'s rule).
  - Successes per arm: the units whose primary-metric value is 1. v1 is integer successes over integer trials
    with one trial per unit (ADR-0306), so a primary value other than 0 or 1 refuses by name. That is ADR-0306's
    revisit trigger, surfaced instead of rounded.
  - Guardrails: each `role: guardrail` metric. Judging one needs a threshold, and the manifest schema (ADR-0301)
    declares none, so every declared guardrail is `unresolved`. decide already refuses unresolved rather than scoring
    it as no breach, so a module that declares a guardrail cannot conclude until the evolve lane adds a threshold. The
    refusal names that.
  - Cohort violations: the board's assignment conflicts.
  - Missing windows: the board's MISSING count.
  - A verdict already on the spine sets `computedBefore`, which refuses (compute once).
  - `configHash` and `metricHash` ride the receipt.
  - A `no-verdict` result is not an `experiment.verdict`: the payload needs a bound and a delta that no-verdict
    does not have. `conclude` prints decide's reasons and exits 2, and nothing is written.

No product in this repository declares an `evolve` section today. The real client is a consumer repo (ADR-0307). On
this tree, then, `open` refuses by name, and the face renders that refusal verbatim. That is the ops working, not
failing. The receipts are proven by the evolve CLI's own fixture over a fixture repo (`--repo`), and the door's parity
fixture holds the refusal identical by door and by hand.

### 5. The other verbs keep to PR 1's shapes

- **Emit plan** (the tool prints its seal line and the door runs it): cap proposal, open, measure, conclude.
- **Tool-owned receipt with a `--dry-run` plan:**
  - register job (`arc-jobs register <job> --dry-run` / `--receipt`, `note.logged`)
  - trial (`judgement.mjs seal --dry-run` / `--emit`). A seal burns its correlation, so it cannot be the plan.
  - bench propose (`arc-bench --propose --from <candidate out>`: from an existing run's evidence, with no re-run
    and no spend)
- **Proposal branch plus `approval.requested`:** driver switch, tier proposal and pin source. A tier is law
  (ADR-0069): a tier change is a reviewed diff to `engine/router.yaml`, so the tier proposal writes the
  `classes.<c>.tier` edit to a branch rather than only asking. Both engine proposals come from one engine CLI
  (`engine/propose.mjs`). It edits one line of the class's block and re-runs the router's own loader
  (`routerFaults`) over the proposed file before anything is written; a proposal the router would refuse to load
  is refused.

## Consequences

**Easier.** Every kernel verb runs its lane's own tool through the door. A sim door can rehearse all ten without
registering a task or writing a branch. The branch writer is one library with one fixture. Terminate, pin tool,
switch profile and add agent (PR 4) inherit it rather than growing four.

**Harder.** Two effect ops cannot be proven end to end on a sim door. Their apply path is proven by their lane's CLI
fixture in a scratch repository (the branch writer), or by hand on Windows (register, as `jobs-register.bats`
already does for the real scheduler). Evolve's ops refuse on this tree until a module declares an evolve section:
honest, and visible in the face as the tool's own sentence.

**Not decided here.** Which arc surface, if any, becomes an evolve experiment. That is the evolve lane's call and a
real client's. Nothing here declares an evolve section.
