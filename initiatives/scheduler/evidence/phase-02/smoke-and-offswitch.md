# Phase 02 evidence — the next-minute smoke and the off-switch, against the real OS

Windows 11 Home, unelevated, 2026-08-12. Every line below is transcript, not description.

## 1. S4U was refused, and that is the phase's headline finding

ADR-0803 pinned `LogonType = S4U` on documented grounds. The first real registration:

```
+ FullyQualifiedErrorId : HRESULT 0x80070005,Register-ScheduledTask     # access denied
```

Isolated rather than guessed at — S4U removed, everything else held constant:

```
INTERACTIVE-DEFAULT: ok
```

**S4U cannot be REGISTERED without elevation.** The research was right about what S4U does and
silent about what it costs to create. Recorded as ADR-0803 Amendment 1, with the weaker guarantee
stated plainly: these jobs run only while the user is logged on.

## 2. Registration, with all six settings read back OFF THE OS

```
$ scheduler-task.ps1 -Action register -TaskName arc-smoke-probe -Trigger daily@23:33 ...
{"ok":true,"path":"\arc\\","task":"arc-smoke-probe"}

$ scheduler-task.ps1 -Action query -TaskName arc-smoke-probe
{"exists":true,"state":"Ready","command":"cmd.exe",
 "nextRunTime":"2026-08-12T23:33:00.0000000+05:30",
 "settings":{"DisallowStartIfOnBatteries":false,"StopIfGoingOnBatteries":false,
             "StartWhenAvailable":true,"WakeToRun":false,
             "LogonType":"Interactive","RunLevel":"Limited"},
 "lastTaskResult":267011}
```

All six match `PINNED_SETTINGS`. Asserting what we SENT would have proven only that we sent it.

`lastTaskResult: 267011` is `0x41303`, SCHED_S_TASK_HAS_NOT_RUN — **the exact value the Phase-0
fake was written to return** for a never-run task. The fake and the real OS agree on the one code
that separates "has not run yet" from "ran and returned nothing", which is precisely the
distinction this smoke test has to make.

## 3. It fired

```
FIRED after ~50s
$ cat smoke-fired.txt
FIRED

$ scheduler-task.ps1 -Action query -TaskName arc-smoke-probe
lastRunTime: 2026-08-12T23:33:00.0000000+05:30 | lastTaskResult: 0 | state: Ready
```

Fired at its slot, wrote its marker, exit code 0 recorded by the OS. The marker is the assertion
that matters: `lastTaskResult: 0` alone would also be true of a task that ran and did nothing.

## 4. The off-switch, rehearsed

```
$ ... -Action list                                   {"tasks":["arc-smoke-probe"]}
$ ... -Action unregister -TaskName arc-smoke-probe   {"existed":true,"ok":true}
$ ... -Action list                                   {"tasks":[]}
$ ... -Action query -TaskName arc-smoke-probe        {"exists":false}
```

Clean. Nothing of this probe remains on the machine.

## 5. A defect that reads like a caller error and is not

The script assigned its task-action object to `$action`. PowerShell variable names are
**case-insensitive**, so that is the same variable as the `$Action` parameter, whose `ValidateSet`
then rejected it:

```
The variable cannot be validated because the value MSFT_TaskExecAction is not a valid
value for the Action variable.
```

The message names the PARAMETER, so it presents as a bad argument from the Node caller rather
than as a collision inside the script. The local is `$taskAction` now, with the reason written
beside it.

## 6. AV and OneDrive on the canonical drive — measured, and one part left open on purpose

The DoD asks for this because a scheduled task that a scanner delays or a placeholder file that
never hydrates both present as the same symptom: a job that is registered, fires, and does
nothing.

```
$ powershell -NoProfile -Command "..."
ONEDRIVE_ENV=C:\Users\ashiq\OneDrive
CANONICAL_EXISTS=True                       # E:\Work_Hub\01_Automemory\arc
DRIVE_TYPE=Fixed  FS=NTFS
REALTIME=False                              # Defender
EXCLUSION_PATHS=                            # none
AV=Windows Defender  state=0x60100
AV=McAfee            state=0x41000
AMSERVICE=False  ANTIVIRUS=False  TAMPER=False
```

**OneDrive is settled: it is not in the picture.** The OneDrive root is `C:\Users\ashiq\OneDrive`
and the canonical clone is on `E:`, a fixed NTFS volume outside it. No Files-On-Demand
placeholders, no reparse points to hydrate, so ADR-0803's open question about S4U and file
hydration is moot twice over — once because the path is not synced, and once because Amendment 1
moved the logon model to `Interactive`, which has the user's own token and network access anyway.

**AV is NOT fully settled, and saying so is the point.** Defender's antimalware service is OFF on
this machine; the registered real-time scanner is **McAfee**, whose exclusions cannot be
enumerated through `Get-MpPreference` — that cmdlet reports Defender only. So "no exclusion paths"
above says nothing about the scanner that is actually running, and reading it as an all-clear
would be exactly the kind of green tick this lane keeps refusing.

What IS proven: a real scheduled task on this machine fired at its slot and the OS recorded exit
`0` (§3 above). What is NOT yet proven: that **node** launched by Task Scheduler against the repo
on `E:` runs unmolested — the smoke ran `cmd.exe` writing a marker, which is a lighter thing for a
scanner to look at than a Node process opening a git tree.

That gap is not closable by another five-minute smoke; it is closed by the two real jobs running
for a week, which is Phase 03. It is therefore carried forward as a **named watch item** rather
than a checked box: if a run is ever recorded late or missing with no receipt, the first
hypothesis is scanner interference on first-launch of `node.exe` from the task host, and the check
is the per-job log at `<spine>/job-logs/<name>.log`, which exists precisely because Task Scheduler
discards stdout and stderr.

## 7. The gaps this phase closed after the smoke

Three DoD items were still open when the smoke passed, and each turned out to be a real hole
rather than paperwork.

**A drifted readback was a WARNING.** `register` read the settings back off the OS and, if they
disagreed, printed `WARN` and exited 0 — leaving a task on the machine carrying a setting nobody
chose. That is the worst of the three possible outcomes, because a heartbeat that looks on and is
dead is the failure the whole settings rule exists to prevent, and a warning on an unattended
surface is a thing nobody reads at 00:15. It is now `registerVerified`, which **unregisters the
task again** and exits 2, and both the CLI and the contract fixture drive that one function.

**The fail-closed gate had no fixture, and the obvious one would have been vacuous.** `register`
exits 2 on a non-Windows machine anyway, at the platform check — so a fixture asserting "a red
gate exits 2" would have passed on two of the three CI legs *without the gate having run*. Two
changes make it real: the policy gate is now evaluated **before** the platform check, and the
assertions read the REASON out of stderr rather than the exit code. `tests/jobs-register.bats`
opens with the negative control — the gate is green against this repo, unforced — because a gate
that is red for some unrelated reason would satisfy every red case in the file.

**The weaker logon guarantee was in an ADR and nowhere else.** ADR-0803 itself said moving to
`Interactive` "would need saying out loud in the brief panel". It now is, on every panel render
and after every register, and the line is **derived from `PINNED_SETTINGS.LogonType`** — so if the
pin ever moves back to S4U the disclosure stops claiming a limit that no longer applies.

## Not yet done, and why

The two REAL jobs are not registered from this worktree. `spineRoot()` refuses inside a linked
git worktree by design, so a task registered from here would point at a checkout whose spine does
not exist — every run would fail, and the receipts that prove the proving week would land nowhere.
Registration belongs to the canonical clone, after the merge.
