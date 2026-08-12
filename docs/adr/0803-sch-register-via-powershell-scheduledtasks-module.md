# ADR 0803 — register through the PowerShell ScheduledTasks module, with every power setting written explicitly

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** a job must run when no user is logged on and S4U proves insufficient — the logon model, and with it the registration path, is reopened.

## Context

SCH-J says Windows registration is "specified, not improvised": absolute node path, cwd = repo
root, battery/AC and wake settings *explicitly decided and recorded*, task runs as the
logged-in user. It does not say which API writes them, and the choice is not cosmetic — it
decides whether the settings can be expressed at all.

The named risk is silent job death: a task that never fires because a default nobody chose said
not to. That risk is real and measurable here.

## Options considered

1. **`schtasks.exe` with command-line switches** — pros: no PowerShell dependency, ships
   everywhere. Cons: its documented parameter table has **no switch** for battery, wake, or
   run-when-missed. The settings that matter cannot be expressed.
2. **`schtasks.exe /create /XML`** — pros: CLI-only and can express everything. Cons: the
   wrapper must generate, escape and diff task XML; readback for the smoke test is
   `/query /XML` string-parsing.
3. **The PowerShell `ScheduledTasks` module** (`Register-ScheduledTask`,
   `New-ScheduledTaskSettingsSet`, `New-ScheduledTaskPrincipal`, `Get-ScheduledTaskInfo`,
   `Unregister-ScheduledTask`) — pros: every setting is a named typed parameter;
   `-Force` makes register idempotent; `Get-ScheduledTaskInfo` returns `LastRunTime` /
   `LastTaskResult` / `NextRunTime` directly, which is exactly the smoke test's readback.
   Cons: shells out to `powershell.exe` from Node.

## Decision

**Option 3.** `arc-jobs register` / `unregister` drive the ScheduledTasks module via
`child_process`, and **write all five power/logon settings explicitly on every registration**,
never inheriting a default.

The reason that carried the most weight: official Microsoft documentation **contradicts itself**
on the default for `StopIfGoingOnBatteries` — the XML schema page's syntax block says
`default="true"` while its own Remarks text says the default is False and "changed from previous
versions", and the separate scripting-property page says True. A setting whose documented
default is self-contradictory cannot be inherited by anything that claims to be deterministic.
The rule this ADR pins is therefore stronger than the mechanism: **no power setting is ever left
unspecified**, because the one that killed the job would be the one nobody wrote down.

Pinned values, written on every register:

```
DisallowStartIfOnBatteries = false   # default is TRUE -- the documented #1 silent-death cause
StopIfGoingOnBatteries     = false   # do not kill an in-flight job on unplug
StartWhenAvailable         = true    # default is FALSE -- see ADR-0804
WakeToRun                  = false   # see ADR-0804 (this machine cannot honour it)
LogonType                  = S4U     # unattended, no stored password, local disk only
RunLevel                   = Limited # least privilege; nothing here needs admin
```

Node's exit code surfaces as `LastTaskResult`, giving a second OS-side signal independent of our
own receipts. Task Scheduler discards stdout/stderr unless the action redirects, so the action
redirects to a per-job log.

**Evidence:** [schtasks create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create)
(parameter table carries no power/wake switch) ·
[New-ScheduledTaskSettingsSet](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset) ·
[DisallowStartIfOnBatteries](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-disallowstartifonbatteries-settingstype-element)
("The default setting for this element is True") ·
[StopIfGoingOnBatteries element](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-stopifgoingonbatteries-settingstype-element)
vs [property](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-stopifgoingonbatteries) — the contradiction ·
[StartWhenAvailable](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-startwhenavailable-settingstype-element) (`default="false"`) ·
[Principal.LogonType](https://learn.microsoft.com/en-us/windows/win32/taskschd/principal-logontype) (S4U: no stored password, no network or encrypted-file access) ·
[Get-ScheduledTaskInfo](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/get-scheduledtaskinfo) ·
[Task Scheduler result constants](https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-error-and-success-constants)
(`0x0` ok · `0x41301` running · `0x41303` never run · `0x41306` terminated). No third-party
package is introduced by this decision; the ScheduledTasks module ships with Windows.
**Confidence:** high — every claim above is from learn.microsoft.com. The one Medium item is
the `StopIfGoingOnBatteries` default, and it is Medium *because the official sources disagree*,
which is precisely why the value is written explicitly rather than relied upon.
**Rejected because:** option 1 — cannot express the settings at all; option 2 — XML generation
and string-parsed readback for no gain over a typed API.

## Consequences

**Easier.** Registration is one readable command per setting, `register` is re-runnable without
duplicating tasks, and the smoke test reads back real values instead of asserting we sent them.

**Harder.** The wrapper now depends on `powershell.exe` and on quoting correctly across the
Node → PowerShell boundary. `S4U` has no network access by documentation, and whether that
breaks OneDrive file hydration on this repo's drive is **unverified** — it is a Phase-2 smoke
check, not an assumption. Windows 11 Home lacks `gpedit.msc` but the Task Scheduler engine, COM
API and PowerShell module are not edition-gated; no Home-specific API limit was found.

**What we would revisit if this goes wrong.** If S4U cannot reach the repo path, the logon model
moves to `Interactive` and the jobs become "runs only while logged on" — which is honest, and
weaker, and would need saying out loud in the brief panel.
