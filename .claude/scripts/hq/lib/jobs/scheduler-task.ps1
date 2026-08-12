<#
  scheduler-task.ps1 -- the ONLY place this repo talks to Windows Task Scheduler.

  A FILE, NOT AN EMBEDDED STRING. A program embedded in a shell string carries no apostrophes,
  and PowerShell is full of them; this repo has shipped that bug twice in one file, the second
  time inside the comment explaining the first. So the whole PowerShell side lives here, takes
  typed parameters, and is invoked with -File. Nothing is interpolated into a command line.

  EVERY POWER AND LOGON SETTING IS WRITTEN EXPLICITLY, ALWAYS (ADR-0803). None is inherited:
    - DisallowStartIfOnBatteries defaults to TRUE, so a laptop task simply never starts.
    - StartWhenAvailable defaults to FALSE, so a missed run is never caught up.
    - StopIfGoingOnBatteries has CONTRADICTORY documented defaults on Microsoft's own pages.
  A setting whose documented default is self-contradictory cannot be inherited by anything that
  claims to be deterministic. The fake refuses a registration that omits one, and so does this.

  WakeToRun is FALSE on this machine by hardware (ADR-0804): powercfg reports S0 Low Power Idle
  as the only available sleep state, and WakeToRun has no documented behaviour on Modern Standby.

  Output is a single line of JSON on stdout so the Node caller parses one thing and never scrapes
  human text. Errors exit non-zero with the message on stderr.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet("register", "unregister", "query", "list")]
  [string]$Action,
  [string]$TaskName = "",
  [string]$Command = "",
  [string]$Arguments = "",
  [string]$WorkingDir = "",
  [string]$Trigger = "",          # daily@HH:MM | weekdays@HH:MM
  [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

# Every arc task is namespaced. Without a folder, `list` cannot tell an arc task from anything
# else the machine schedules, and the off-switch rehearsal could not prove it removed only ours.
$TaskPath = "\arc\"

function Write-Json($obj) { $obj | ConvertTo-Json -Compress -Depth 6 }

function New-ArcTrigger([string]$spec) {
  $parts = $spec.Split("@")
  if ($parts.Count -ne 2) { throw "trigger $spec is not kind@HH:MM" }
  $kind = $parts[0]
  $at = $parts[1]
  if ($kind -eq "daily") {
    return New-ScheduledTaskTrigger -Daily -At $at
  }
  if ($kind -eq "weekdays") {
    return New-ScheduledTaskTrigger -Weekly -At $at -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday
  }
  throw "trigger kind $kind is outside the closed grammar (daily | weekdays)"
}

switch ($Action) {

  "register" {
    if (-not $TaskName)   { throw "register needs -TaskName" }
    if (-not $Command)    { throw "register needs -Command" }
    if (-not $WorkingDir) { throw "register needs -WorkingDir: a task that inherits one runs somewhere nobody chose" }
    if (-not $Trigger)    { throw "register needs -Trigger" }

    # THE LOCAL IS `$taskAction`, NEVER `$action`. PowerShell variable names are
    # CASE-INSENSITIVE, so `$action` and the `$Action` parameter above are the same variable --
    # assigning a task-action object to it overwrites the parameter, and its own ValidateSet then
    # rejects the assignment with "MSFT_TaskExecAction is not a valid value for the Action
    # variable". Measured on the first real registration attempt: the failure names the parameter,
    # not the assignment, so it reads like a bad argument from the caller.
    #
    # Task Scheduler DISCARDS stdout and stderr; there is no capture feature. Without the
    # redirection below a failing job leaves nothing behind but an exit code.
    $inner = $Arguments
    if ($LogPath) {
      $logDir = Split-Path -Parent $LogPath
      if ($logDir -and -not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
      $inner = "$Arguments >> `"$LogPath`" 2>&1"
      $taskAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$Command`" $inner`"" -WorkingDirectory $WorkingDir
    } else {
      $taskAction = New-ScheduledTaskAction -Execute $Command -Argument $Arguments -WorkingDirectory $WorkingDir
    }

    $trg = New-ArcTrigger $Trigger

    # THE SIX, EVERY TIME. -DontStopIfGoingOnBatteries and -AllowStartIfOnBatteries are the
    # positive spellings of the two battery settings; passing them IS writing them explicitly.
    $settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -StartWhenAvailable `
      -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    $settings.WakeToRun = $false

    # INTERACTIVE, NOT S4U -- measured, not chosen. S4U is the documented way to run unattended
    # with no stored password, and it is what ADR-0803 pinned. Registering it here fails
    # HRESULT 0x80070005 (access denied): S4U needs elevation, and this runs unelevated. The same
    # registration under Interactive succeeds, proven by isolating the two on this machine.
    #
    # The cost is real and is stated rather than hidden: the job runs only while the user is
    # LOGGED ON. On a Modern-Standby-only machine that is never woken for a slot (ADR-0804) the
    # difference is small -- it is asleep whenever nobody is at it either way -- and
    # StartWhenAvailable is already the mechanism that lands a missed slot later.
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
      -LogonType Interactive -RunLevel Limited

    # -Force makes register IDEMPOTENT. Without it a second register leaves two tasks firing the
    # same job at the same minute, which is the double-fire case arriving by configuration.
    Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $taskAction -Trigger $trg `
      -Settings $settings -Principal $principal -Force | Out-Null

    Write-Json @{ ok = $true; task = $TaskName; path = $TaskPath }
  }

  "unregister" {
    if (-not $TaskName) { throw "unregister needs -TaskName" }
    $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if ($null -eq $existing) { Write-Json @{ ok = $true; existed = $false }; break }
    Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
    Write-Json @{ ok = $true; existed = $true }
  }

  "query" {
    if (-not $TaskName) { throw "query needs -TaskName" }
    $t = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if ($null -eq $t) { Write-Json @{ exists = $false }; break }
    $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath
    $s = $t.Settings
    Write-Json @{
      exists = $true
      state = [string]$t.State
      command = [string]$t.Actions[0].Execute
      arguments = [string]$t.Actions[0].Arguments
      cwd = [string]$t.Actions[0].WorkingDirectory
      # Reported in the SCHEMA's polarity, not PowerShell's, so the Node side compares against
      # the same six names the fake and ADR-0803 use.
      settings = @{
        DisallowStartIfOnBatteries = [bool]$s.DisallowStartIfOnBatteries
        StopIfGoingOnBatteries     = [bool]$s.StopIfGoingOnBatteries
        StartWhenAvailable         = [bool]$s.StartWhenAvailable
        WakeToRun                  = [bool]$s.WakeToRun
        LogonType                  = [string]$t.Principal.LogonType
        RunLevel                   = [string]$t.Principal.RunLevel
      }
      lastRunTime = if ($info.LastRunTime) { $info.LastRunTime.ToString("o") } else { $null }
      lastTaskResult = [int]$info.LastTaskResult
      nextRunTime = if ($info.NextRunTime) { $info.NextRunTime.ToString("o") } else { $null }
    }
  }

  "list" {
    $tasks = Get-ScheduledTask -TaskPath $TaskPath -ErrorAction SilentlyContinue
    $names = @()
    if ($null -ne $tasks) { $names = @($tasks | ForEach-Object { [string]$_.TaskName } | Sort-Object) }
    Write-Json @{ tasks = $names }
  }
}
