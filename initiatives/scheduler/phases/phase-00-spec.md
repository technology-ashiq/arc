# Phase 00 — the law and the wrapper core

**Goal (one line):** A job declared in `hq.jobs.yaml` can be run by one command and leaves a correct receipt — and a job that would misbehave is rejected before it ever runs.
**Appetite:** 1.0 day to build, plus the plan's 0.25-day reserve for adversarial rework. The kill trigger at **1.5 days** is the hard bound on both — blown appetite = cut scope or kill, never extend silently.
**Depends on:** none

## Exit criteria (Definition of Done)

- [ ] `hq.jobs.yaml` exists at repo root with the closed v1 schema (SCH-B), parsed by the SAME `.claude/scripts/engine/yaml-subset.mjs` — no second parser class
- [ ] `jobs-lint` exits 2 on **≥12 pinned hostile classes**: bad cadence · unknown script or process entry · entry outside `.claude/scripts/hq/jobs/` · missing `min` budget · `inr` present on a script-job · `inr` missing on a process-job · duplicate job name · spend-capability `policy_kind` · credential-looking value · entry that writes `hq.jobs.yaml` or `.claude/scripts/**` · monthly-ceiling breach · `policy_kind` absent from the live subject set
- [ ] `jobs-lint --bill` prints the worst-case month (Σ job `inr` × slots/month) and v1 prints ₹0
- [ ] **Adversarial pass runs on the commit that ships `jobs-lint`, and gates that commit's own merge** — not at phase close. Two fresh agents on different surfaces (one on the lint's decision logic, one on the shell/OS + path boundary), neither having seen the implementation, each carrying this lane's running defect list with instructions to check every item in every OTHER file. Every hole found is fixed AND pinned as a fixture, and the report is committed to `initiatives/scheduler/evidence/phase-00/adversarial.md` **before wrapper-core work begins**. Binding it to the close instead is how arc-portfolio skipped the mandated pass on three gates for an entire phase (retro-log 2026-08-02) — as one DoD bullet among twelve it is a bullet; as a merge gate it is a gate
- [ ] **The pass attacks the TEST, not only the rule:** a mutant `jobs-lint` that returns exit 0 unconditionally must be CAUGHT by the hostile corpus, and a mutant wrapper re-implementing an allow/deny decision under a different name must be CAUGHT by REQ-02's authorization check. A guard with no negative control has not been tested
- [ ] Wrapper core (`.claude/scripts/hq/arc-jobs.mjs` + thin `.sh` entry per ADR-0031): per-job lock reusing `withLock`, slot computation (normal fire floors to the nearest slot; `--slot` targets a named missed slot), `run.completed` emission with idem `<job>@<scheduled_for>`, git-state guard (MERGE_HEAD / rebase → skip + `note.logged`), POL-D authorization via `authorizeRun`, script-job hard timeout from `min`
- [ ] Process-job delegation proven against the engine's **mock driver in fixtures only** — no real driver, no engine code touched
- [ ] Both v1 job scripts written under `.claude/scripts/hq/jobs/`: `brief-materialize.mjs` and `day-close-roll.mjs`. The roll walks `listDays()` oldest-first, skips today, skips `isDayClosed()`, and counts `sealed` / `already_sealed` / `empty` as **three distinguishable outcomes** in its receipt payload (ADR-0805) — never one exit code
- [ ] `processes/brief-materialize.process.yaml` and `processes/day-close-roll.process.yaml` stubs exist, each declaring only the tools it uses and carrying **`job_stub: true`**
- [ ] **`arc-run` refuses a job stub** (ADR-0802): one check on its existing entry-resolution path reads `job_stub` from the resolved process file and exits non-zero *before any driver is selected*. This is the single named engine exception in PLAN § Current state — the diff is that check and nothing else. Fixtures prove both directions: a job stub is refused, and the three real processes still run
- [ ] **Crash-then-retry fixture** (pre-mortem row 3): `day-close-roll` is crashed after sealing some but not all days, then re-run at the SAME slot. Its retry receipt must be *visible on the spine* with the days it actually sealed — asserting that a legitimate retry is not swallowed by the `job@slot` idem key and reported as a working dedup. This is the arc-cycle2 shape (100 real receipts lost, read as fine for four days) and it is the one open row in the pre-mortem
- [ ] **Slot-floor clock fixture** (assumptions ledger): a `daily@00:15` IST slot is computed correctly under a UTC system clock, and `--slot` catchup names the same slot the normal fire would have floored to. A slot computed on the wrong date makes the idem key name a slot that never existed
- [ ] `hq.policy.yaml` rows for `process:brief-materialize` and `process:day-close-roll` are LIVE — applied by the owner from a complete generated file (no agent can write that file); `authorizeRun` returns `mayInvoke: true` for both, proven by fixture
- [ ] v1 job set is exactly the two script-jobs; no `lexos-canary` row is written (ADR-0806)
- [ ] tests added & green **on CI**, read per-JOB
- [ ] live demo run + output checked
- [ ] contract tests green against the Windows Task Scheduler **fake** (register→query→unregister round-trip preserves all 5 ADR-0803 settings)
- [ ] zero writes outside this initiative, `.claude/scripts/hq/jobs/`, `.claude/scripts/hq/arc-jobs.*`, `processes/`, root `tests/`, and the single scoped job-stub check in `.claude/scripts/engine/arc-run.mjs`
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `npx bats tests/jobs-lint.bats tests/arc-jobs-core.bats tests/arc-jobs-policy.bats`
- **Expected failure first:** `tests/jobs-lint.bats` case `rejects a policy_kind absent from the live subject set` fails RED before this phase is built, with `command not found: jobs-lint` — and once the binary exists but before the subject-set check is wired, it fails with `expected exit 2, got 0` on the fixture `fixtures/jobs/bad-policy-kind.yaml`. Both are asserted as the red state, so the test proves the check RAN rather than that the file merely parsed.
- **Live demo scenario:** (1) `node .claude/scripts/hq/arc-jobs.mjs list` prints both jobs with their cadence and next slot. (2) `node .claude/scripts/hq/arc-jobs.mjs run day-close-roll` on a spine with two unsealed days seals both, oldest first, and prints `sealed=2 already_sealed=0 empty=0`. (3) Re-running the same command immediately prints `sealed=0 already_sealed=2 empty=0` and exits 0 — idempotent, and visibly so. (4) `arc-run --process day-close-roll` refuses with a non-zero exit naming the job-stub guard.
- **Real-system check:** n/a — fakes only this phase. No OS registration, no real driver, no network.
- **Expected evidence:** `initiatives/scheduler/evidence/phase-00/` — CI run id with per-JOB conclusions, `adversarial.md`, the demo transcript, and the readback of the applied `hq.policy.yaml` rows.

## Rabbit holes in this phase

- Writing a second YAML parser → reuse `engine/yaml-subset.mjs`, no exceptions.
- Growing a second policy interpretation inside the wrapper → call POL-D's `authorizeRun` and nothing else; a grep-lint proves there is no second read.
- Making `close-day` general → the multi-day roll lives in the job (ADR-0805); the spine emitter is not touched.
- Letting the `processes/` stubs drift into real engine processes → they declare tools only, and the `arc-run` refusal guard is an exit criterion with its own fixture, not a note.

## Out of scope for this phase

Any OS registration and any `register`/`unregister` surface → Phase 02. Any brief change, the jobs panel and the SessionStart nudge → Phase 01. Real driver invocation for process-jobs → deferred to the first LIVE process-job with SCH-K's engine diff, which is not this cycle.

## Your-setup / pending

**One owner action blocks this phase's close:** `hq.policy.yaml` needs two `kinds:` rows added (`process:brief-materialize`, `process:day-close-roll`). That file is denied to every agent by both `permissions.deny` and `ungrantable_resources`, so it must be applied by hand. I generate the complete file from the live one so it is a single copy rather than a diff to apply — the shape that worked for policy's Phase-04 settings edits. Nothing else is needed from you in this phase.

## Non-negotiables (verbatim from PLAN)

- No daemon: arc never runs a resident process, and the OS scheduler is the only timer.
- The scheduler layer owns ZERO retries: ADR-0203 and ADR-0204 own the ladder, and a failed run's retry is its next cadence slot.
- Every execution, attended or scheduled, walks one path: lock, guards, execute, receipt.
- Authorization goes only through the shared POL-D library per ADR-0802, and this lane never writes a second reading of policy.
- Money-touching jobs are unschedulable: banned by `jobs-lint` on top of policy's own money law, not merely out of scope.
- The overlap lock is per job and reuses the spine's `withLock` discipline; a second hand-rolled lock is banned.
- This lane numbers ADRs only in 0800-0899 per ADR-0800, and cites no receipt it has not read per ADR-0801.
- A gate or parser is not done until two fresh adversarial agents on different surfaces have attacked it and every hole found is fixed and pinned as a fixture.
- A test that passes proves the assertion held, not that the code ran: assert it RAN before asserting what it printed.
- "Tests green" means green on CI, read per-JOB, at a run whose head SHA is the local HEAD.
