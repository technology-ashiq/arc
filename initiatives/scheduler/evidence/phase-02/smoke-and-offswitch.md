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

## Not yet done, and why

The two REAL jobs are not registered from this worktree. `spineRoot()` refuses inside a linked
git worktree by design, so a task registered from here would point at a checkout whose spine does
not exist — every run would fail, and the receipts that prove the proving week would land nowhere.
Registration belongs to the canonical clone, after the merge.
