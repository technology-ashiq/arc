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
  - Alpha: the manifest's `evals.alpha`. One the pinned test has no quantile for refuses (amended below).
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

- **Emit plan** (the tool prints its seal line and the door runs it): cap proposal.
- **Bound apply** (the plan prints a digest, and the apply re-derives and writes only if it still holds; amended
  below): open, measure, conclude, driver switch, tier proposal, bench propose, pin source, trial. A trial is bound
  to the branch, main's commit and the seal's arguments -- its commitment is drawn only when it seals -- and it is
  checked BEFORE the seal burns the correlation.
- **Tool-owned receipt with a `--dry-run` plan:**
  - register job (`arc-jobs register <job> --dry-run` / `--receipt`, `note.logged`)
  - bench propose (`arc-bench --propose --from <candidate out> --champion <champion out>`). It works from an
    existing run's evidence, with no re-run and no spend. A new flag on bench's closed set, recorded here the way the
    Phase 1 two were. The dry run computes every gate and diff in a scratch directory and raises nothing. For real,
    the artifacts land beside the spine (`<state>/bench/proposals/`, gitignored state, never a tracked file), and
    the same candidate twice is refused.
- **Proposal branch plus `approval.requested`:** driver switch, tier proposal, pin source and trial.
  - Pin source is `absorb/pin.mjs`. study.mjs keeps its no-execution-primitive boundary; pin.mjs is the file
    that spawns.
  - Trial is `absorb/trial.mjs` over `judgement.mjs seal --bundle-dir`: the commitment goes to the branch at
    `<evidence>/commitment.txt`, and the payload still names `<evidence>`. A seal burns its correlation, so the
    branch is checked writable BEFORE the seal. The seal's flags became a closed set on the way: an unknown flag
    used to be ignored, so a mistyped `--dry-run` sealed for real.
- **A tier is law** (ADR-0069): a tier change is a reviewed diff to `engine/router.yaml`, so the tier proposal writes the
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

## Amendment, 2026-09-19: what PR 3a's two attackers found

The logic attacker found 13 defects and the shell attacker found 11. Each one is fixed and pinned in
`tests/face/kernel-ring.mjs`, `tests/face/proposal-branch.mjs` or `tests/face/work-door.mjs`. The fixes change four
of the decisions above.

**An apply is bound to its plan (core/plan-expect.mjs).** A plan is read, then applied up to fifteen minutes later.
In between, main or the spine can move. An apply that re-derived its write from the world as it stood then wrote
something the owner never saw:
- a driver switch planned against one router was written against another, silently reverting a merge;
- three opens planned while nothing was open all landed past the cap of two;
- a second conclude, and a measurement planned before the verdict, both landed after it.

The fix: open, measure, conclude and both engine proposals print the digest of exactly what their apply would
write as the last line of the plan: `{"expect":"<64 hex>"}`. An `expect: true` row has the door append
`--expect <digest>` to its apply. The tool re-derives everything, re-runs every check, and writes only if the
digest still holds. Otherwise it refuses with `PLAN_STALE` and writes nothing. A plan with no digest is `NO_EXPECT`.
Evolve's verbs stop being emit plans: the CLI writes through arc-event itself, and prints
`receipt: <kind> <ULID>`. propose also passes the base it read to the branch writer, which refuses `BASE_MOVED`
if main has moved by the time it writes.

**Conclude counts what the board counts, and checks what the ADRs require.**
- Counting:
  - Receipts are counted after supersedes, from the fold's kept set. All five successes corrected to 0 used to
    still give a delta of 1.
  - A receipt over zero observations is not a trial.
  - A unit reported as both 0 and 1 in one window is refused (`CONFLICTING_VALUES`), never scored by its maximum.
- Assignment:
  - Each unit is re-placed by `assign()`, and a recorded assignment must agree with it.
  - A receipt whose arm or cohort disagrees is a `COHORT_VIOLATION` and is refused. A champion unit also written
    as the challenger used to count in both arms.
  - Completeness is judged on the verdict cohort alone. One generation unit used to "complete" a window the
    verdict cohort had only half measured.
- The ADRs' requirements:
  - The improvement is direction-adjusted (ADR-0306): lower-is-better counts the units whose event did not happen.
  - The alpha is the manifest's, and an alpha with no pinned quantile refuses (`ALPHA_UNPINNED`).
  - TTL is enforced on measure and on conclude (`EXPIRED`, ADR-0310).
  - Canonical drift refuses on conclude as it already did on measure.
  - An experiment has exactly two arms, and one opened twice refuses.
- The config hash carries the primary metric and its direction.
- The attack also found that the verdict test itself paired Newcombe's terms the wrong way round. That is fixed in
  the evolve lane's own file; see ADR-0311's correction.

**The proposal writer runs git bounded and neutered.**
- Every git call is async, under `core/spawn-bounded.mjs`, which the work door's `runTool` now shares. Before,
  a timeout killed Git for Windows' launcher and left the real git holding the temp index. A backgrounded hook
  turned a 700 ms write into a 60 s "timeout".
- Every call turns off:
  - hooks
  - fsmonitor (its hook ran inside a proposal and left a daemon watching the owner's repo)
  - the split index (it wrote into the owner's `.git`)
  - the untracked cache
  - auto gc and maintenance
  - the per-user attributes file (`*.yaml -diff` made the plan read "Binary files differ")
  - lazy fetch
- Main's bytes are read as strict UTF-8. The diff's base side is main's raw bytes.
- Refused names: a branch that collides in another case or as a directory, a name ending in a dot, a Windows
  device name, and a name opening with a dash.
- A failed `update-ref` is named by its real cause.
- A temp-dir cleanup that fails after the write is never the outcome, and propose exits 1 only once the branch is
  written.

**propose and arc-jobs.**
- The engine proposal's branch puts the class last. `face-ask` followed by `-` made `sk-` inside the name, the
  spine's secret scanner read it as an API key, and every face-ask proposal wrote its branch before its approval
  was refused. The approval is now judged by the spine before anything is written.
- arc-jobs refuses:
  - a dash-like word that is not a whole `--flag`, in any spelling
  - a flag another command owns
  - a second job name

`register day-close-roll -dry-run` would have registered the job for real.

## Amendment, round 2 (same day): what the fixes' own attackers found

A second, fresh pair attacked the round-1 fixes. The logic attacker found 8 defects and the shell attacker found 7.
Each is fixed and pinned. Three change decisions above.

- **A no-verdict at floor is recorded.** §4 said a no-verdict writes nothing. That let conclude be re-run as the
  data grew until it won, which is exactly the peeking ADR-0306's compute-once forbids. A test that was COMPUTED
  (both arms at floor, every window complete, no violation, no guardrail left to judge) and did not clear is now an
  `experiment.verdict` with outcome `no-verdict` and its stats. That is final. A test that cannot be computed yet
  still writes nothing.
- **Every bound apply refuses without its digest,** by hand as by the door. propose's unbound "no plan" mode is
  gone. The digest covers every byte an apply writes, the commit message and the approval included.
- **The evolve apply is one locked step:** read, re-check, compare and write inside `.evolve-apply.lock`, so
  concurrent applies cannot all pass the cap.

The rest are twins of rows already in this ADR's amendment:
- an open counted from the original rather than the kept set
- a supersede-cycle guard that broke chains
- config hooks (`hook.<name>.*`) that core.hooksPath does not reach
- a written branch reported as someone else's
- a group SIGKILL that left a nested tool no time to end its own groups (now SIGTERM first; SIGHUP handled)
- a delimiter in TMP
- the commit encoding
- the emitter's id line behind `process.exit`

## Amendment, PR 3b (same day): what the second half's two attackers found

PR 3b (bench `--propose --from`, absorb pin, absorb trial) got its own fresh pair, carrying every fixed-defect row.
The logic attacker found 8 defects and the shell attacker found 12; several were one defect found twice. Each is
fixed and pinned. Five change decisions above.

- **Compute-once holds at the plan card too.** A conclude plan says the test is computable, over which units and
  windows, and binds the test's INPUTS (`n_per_arm`, `config_hash`, `metric_hash`); the outcome is a function of them.
  It never shows the bound: the first cut printed it and recorded nothing, so the owner could plan again as the data
  grew and apply only the plan that won. A refusal names what gates the test, never the bound `decide()` computed
  anyway. The apply prints the result after its receipt lands.
- **The spine's scanner joins the caller's strings only.** The adjacency views joined the emitter's own id, ts and
  idem, made from the clock, so a dry run could not predict its emit. They are still scanned whole in every canonical
  view; a key split across two caller fields is still refused.
- **The real receipt is judged before the effect, not a draft.** `judgement.mjs seal --judge` asks the spine about the
  payload it will print (the drawn labels, the real commitment) before its nonce is written; trial passes it. A hand
  seal keeps its old behaviour, because the suite seals into temp bundles the spine would refuse. `writeProposal`
  takes `beforeRef(commit)`: propose and pin judge their approval WITH the real commit, and a refusal writes no ref.
- **Branch names are built by `proposalBranch()`,** which defuses the key-shaped prefixes a slug can spell (sk-,
  xox?-); `checkBranch` refuses one that kept them. The writer also refuses a path that differs from main's only by
  case (CASE_CLASH), a file/directory conflict with main (BAD_PATH), and a TMP holding the path delimiter in every
  entry point, the pre-seal check included.
- **Bench `--propose --from` is keyed on candidate AND champion, and marked only once an approval lands**
  (`approval.id`). The store is `<spine root>/bench/proposals`, inside the spine's own gitignored root. "Different
  runs" is compared by content. The approval is judged by the spine (with bench's `--process`) before anything is
  written, and an apply whose approval did not land exits 1 (PARTIAL) with nothing marked.

The rest are twins of rows already here:
- trial's reused-bundle guard now reads main
- a half-failed seal is reported as sealed (exit 1)
- the id line after the effect cannot turn a landed event into a refusal
- the leads reader knows the named locks withLock takes
- a config hook named `x=y` is disabled through `GIT_CONFIG_*`
- every temp cleanup in bench is litter
- the scaffold records a source outside the repo by its folder name, not the owner's path
- the shutdown pause shrinks with depth
