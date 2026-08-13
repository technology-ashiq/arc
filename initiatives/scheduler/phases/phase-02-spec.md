# Phase 02 — the cron flip

**Goal (one line):** The heartbeat runs unattended on the OS's own timer — and refuses to register itself at all if the policy engine is not enforcing.
**Appetite:** 0.75 day — cut from 1.0 on evidence, since ADR-0803 retired this phase's two live unknowns (which API can express the settings, and what the settings are) with citations, leaving execution rather than discovery. Blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01

**GATE — checked before any work in this phase, never assumed:** the policy enforcement fixtures are GREEN. Policy has been LIVE since Cycle 9 (merged `677b67e` / PR #130; cycle closed 2026-08-10 with all five phases done, and the three owner `.claude/settings.json` edits applied in PR #147 / `e594d6e`). This gate re-runs those fixtures and reads the result; a green history is not a green run.

## Exit criteria (Definition of Done)

- [ ] `arc-jobs register <name>` and `unregister <name>` drive the PowerShell `ScheduledTasks` module (ADR-0803) — never raw `schtasks`, which cannot express these settings at all
- [ ] **All five power/logon settings written explicitly on every register**, never inherited: `DisallowStartIfOnBatteries=false` · `StopIfGoingOnBatteries=false` · `StartWhenAvailable=true` · `WakeToRun=false` · `LogonType=S4U`, plus `RunLevel=Limited`. A fixture asserts each value is present in the registration call, because the documented default of `DisallowStartIfOnBatteries` is **True** and the official docs contradict themselves on `StopIfGoingOnBatteries`
- [ ] `WakeToRun=false` is correct for this machine and the reason is recorded: `powercfg -a` reports S0 Low Power Idle as the only available sleep state, with S1/S2/S3 firmware-unsupported and hibernation disabled (ADR-0804)
- [ ] Absolute node path · cwd = repo root · task action redirects stdout and stderr to a per-job log, because Task Scheduler discards both otherwise
- [ ] `register` is idempotent — re-running it does not create a duplicate task (`-Force`), proven by a fixture
- [ ] **Next-minute smoke test green against the real OS:** register a throwaway job for the next minute → it fires → `Get-ScheduledTaskInfo.LastTaskResult` reads back `0` → the receipt lands on the canonical spine → unregister leaves no residue. Captured as a fixture-backed runbook
- [ ] **Fail-closed fixture:** with the policy enforcement fixtures made to fail, `register` exits 2 and registers nothing — so if policy is ever rolled back, the unattended half turns itself off rather than running unpoliced
- [ ] Both v1 jobs registered and their settings read back off the live OS, not asserted from what we sent
- [ ] **Off-switch rehearsed:** `unregister` for all jobs → Task Scheduler state verified clean by query. The whole heartbeat turns off with one command
- [ ] S4U's documented lack of network access is checked against this repo's drive — if the job cannot read the repo under S4U, the logon model moves to `Interactive` and that weaker guarantee is stated in the brief panel rather than hidden
- [ ] AV / OneDrive interference on this drive documented
- [ ] tests added & green **on CI**, read per-JOB (the OS-touching smoke is Windows-leg only and its evidence is captured by hand)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when this phase starts: the OS-facing surface is proven by a real next-minute registration whose result is read back off Task Scheduler rather than asserted, plus a fail-closed fixture proving `register` refuses when policy enforcement is red.

## Rabbit holes in this phase

- Inheriting any power default because it "looks right" → every one of the five is written explicitly; the one that kills the job is the one nobody wrote down.
- Trusting `WakeToRun` on this hardware → settled by `powercfg -a` in ADR-0804, not by preference.
- Parsing `schtasks /query /XML` strings → the typed PowerShell readback exists; use it.
- Treating a green policy history as a green policy run → the gate re-runs the fixtures.

## Out of scope for this phase

POSIX cron registration for consumer repos → documented, not built. Multi-machine scheduling → a no-go (one spine, one machine). Push notifications → the brief and inbox are the alerting; the OS on-failure toast is configured, not built.

## Your-setup / pending

The next-minute smoke and the off-switch rehearsal run against your real machine's Task Scheduler. Nothing to paste — but this phase briefly creates and deletes a throwaway scheduled task on your box, and registers the two real jobs at its end.

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
