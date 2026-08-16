#!/usr/bin/env bats
# Phase 00 -- the CONTRACT TESTS for the plan's single external dependency (Windows Task
# Scheduler) and for process-job delegation.
#
# Phase 0 proves the contract against the FAKE; Phase 2 proves the SAME contract against the
# live OS. That ordering is the fake-drift firewall: the fake is written against the contract
# rather than against whatever the real thing happened to do on the day someone looked.
#
# The fake is deliberately STRICTER than a permissive stub. It refuses a registration that omits
# any pinned power setting, because the documented default of DisallowStartIfOnBatteries is TRUE
# (the task simply does not start on battery) and of StartWhenAvailable is FALSE (a missed run is
# never caught up) -- and Microsoft's own pages contradict each other on StopIfGoingOnBatteries.
# A permissive fake would pass Phase 0 and hand the silent-death bug to a real proving week.
bats_require_minimum_version 1.5.0
load 'test_helper'

H="$ARC_ROOT/tests/fixtures/jobs/contract-harness.mjs"

_run_case() {
  run node "$H" "$1"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
}

@test "scheduler-os: register, query and unregister round-trip through the fake" {
  _run_case roundtrip
  echo "$output" | grep -q '"exists":true' || { echo "$output"; false; }
  echo "$output" | grep -q '"AFTER_UNREGISTER":{"exists":false}' \
    || echo "$output" | grep -q 'AFTER_UNREGISTER:{"exists":false}' \
    || { echo "unregister left residue:"; echo "$output"; false; }
}

@test "scheduler-os: every pinned power setting survives the round-trip" {
  # Asserting each VALUE, not merely that a settings object came back. A round-trip that dropped
  # a setting and returned the rest would satisfy a shape check.
  _run_case roundtrip
  echo "$output" | grep -q '"DisallowStartIfOnBatteries":false' || { echo "$output"; false; }
  echo "$output" | grep -q '"StopIfGoingOnBatteries":false'     || { echo "$output"; false; }
  echo "$output" | grep -q '"StartWhenAvailable":true'          || { echo "$output"; false; }
  echo "$output" | grep -q '"WakeToRun":false'                  || { echo "$output"; false; }
  # Interactive, not S4U. ADR-0803 pinned S4U on documented grounds; the first real registration
  # failed HRESULT 0x80070005 because S4U needs elevation, and Interactive succeeded with
  # everything else held constant (Amendment 1). The cost is stated rather than hidden: these
  # jobs run only while the user is logged on.
  echo "$output" | grep -q '"LogonType":"Interactive"'          || { echo "$output"; false; }
  echo "$output" | grep -q '"RunLevel":"Limited"'               || { echo "$output"; false; }
}

@test "scheduler-os: a registration omitting a pinned setting is REFUSED" {
  # The negative control for the test above. Without it, a fake that ignored settings entirely
  # would pass every assertion in this file.
  _run_case incomplete
  echo "$output" | grep -q '"code":"INCOMPLETE_SETTINGS"' || { echo "$output"; false; }
  echo "$output" | grep -q '"mentions":true' || { echo "the refusal did not name the missing setting"; echo "$output"; false; }
}

@test "scheduler-os: registering twice leaves ONE task, not two" {
  # Register-ScheduledTask -Force overwrites. A register that appended would leave two tasks
  # firing the same job at the same minute, which is the double-fire case arriving by config.
  _run_case idempotent
  echo "$output" | grep -q '^COUNT:1$' || { echo "$output"; false; }
}

@test "scheduler-os: a never-run task reports the OS never-run code, not null" {
  # 0x41303 is SCHED_S_TASK_HAS_NOT_RUN. Reporting null would make "has not run yet" and "ran and
  # returned nothing" the same reading, and the smoke test in Phase 2 distinguishes exactly those.
  _run_case neverrun
  echo "$output" | grep -q "^BEFORE:267011$" || { echo "wanted 0x41303 = 267011 before any run"; echo "$output"; false; }
  echo "$output" | grep -q "^AFTER:0$" || { echo "$output"; false; }
}

@test "scheduler-os: the trigger a job becomes is INSIDE the grammar the PowerShell side accepts" {
  # THE BUG THIS TEST USED TO PIN. It asserted `weekly:MON,TUE,WED,THU,FRI@06:00`, which is what
  # registrationFor emitted -- and scheduler-task.ps1 splits the spec on @ and matches the part
  # before it against exactly `daily` and `weekdays`, so that string throws. No weekdays job could
  # ever be registered, and since `arc-jobs register` with no name walks the enabled jobs in file
  # order and brief-materialize is first, the entire unattended surface was unregisterable.
  #
  # Two green checks looked away from it: the real-OS smoke hand-typed `-Trigger daily@23:33` and
  # never went through registrationFor, and this test asserted the wrong string back. A test that
  # pins the implementation instead of the contract is a test that certifies the bug.
  _run_case trigger-grammar
  echo "$output" | grep -q -F 'DAILY:"daily@00:15"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'WEEKDAYS:"weekdays@06:00"' || { echo "$output"; false; }
  # And nothing outside the grammar is quietly mapped onto daily, which is what the old ternary did.
  for bad in weekly hourly monthly empty; do
    echo "$output" | grep -q "REFUSED_${bad}:\"BAD_TRIGGER\"" || { echo "kind ${bad} was not refused:"; echo "$output"; false; }
  done
}

@test "scheduler-os: the Node grammar and the PowerShell grammar are the SAME grammar" {
  # The two halves of a closed grammar living in two files WILL disagree eventually -- this pair
  # already did, and it cost the whole registration surface. So the accepted kinds are read back
  # OUT of the .ps1 and compared with what Node exports, rather than both being maintained by hand.
  _run_case trigger-grammar
  local ps_kinds node_kinds
  ps_kinds="$(grep -o 'if ($kind -eq "[a-z]*")' "$ARC_ROOT/.claude/scripts/hq/lib/jobs/scheduler-task.ps1" \
    | sed 's/.*"\(.*\)".*/\1/' | sort | tr '\n' ' ')"
  node_kinds="$(echo "$output" | sed -n 's/^KINDS:\(.*\)$/\1/p' | tr -d '[]"' | tr ',' '\n' | sort | tr '\n' ' ')"
  [ -n "$ps_kinds" ] || { echo "read no kinds out of the .ps1 -- the extraction broke, not the code"; false; }
  [ "$ps_kinds" = "$node_kinds" ] || { echo "ps1 accepts [$ps_kinds], node emits [$node_kinds]"; false; }
}

@test "delegate: a scheduled process-job carries the same argv a manual run would" {
  # REQ-02: a scheduled run cannot exceed what a manual run of the same kind could. The whole of
  # that claim lives in the argv -- same process, same driver resolution, same budget flags.
  _run_case delegate
  echo "$output" | grep -q '^IDENTICAL:true$' || { echo "$output"; false; }
  echo "$output" | grep -q '"--budget","inr=40,min=5"' || { echo "budget flags not passed through:"; echo "$output"; false; }
  echo "$output" | grep -q '"--driver","auto"' || { echo "$output"; false; }
}

@test "scheduler-os: the REAL implementation refuses what the fake refuses" {
  # If only the fake enforced the six settings, the contract would be a property of the test
  # double rather than of the system, and the production path could register a task carrying an
  # inherited battery default -- the silent-death bug this whole rule exists to prevent.
  #
  # The harness makes `spawn` throw if it is ever reached, so this also proves the refusal
  # happens in the NODE layer, before anything is handed to PowerShell.
  _run_case real-enforces-settings
  echo "$output" | grep -q '"code":"INCOMPLETE_SETTINGS"' || { echo "$output"; false; }
  echo "$output" | grep -q '"reachedSpawn":false' || { echo "the check ran too late -- it reached the OS:"; echo "$output"; false; }
}

@test "scheduler-os: the fake reports the same never-run code the real OS did" {
  # 0x41303 = 267011 = SCHED_S_TASK_HAS_NOT_RUN. The Phase-02 smoke read exactly this off Windows
  # before the task fired, and 0 after. A fake that returned null instead would make "has not run
  # yet" and "ran and returned nothing" the same reading -- the one distinction the smoke needs.
  _run_case real-and-fake-agree
  echo "$output" | grep -q "^FAKE_NEVER_RUN:267011$" || { echo "$output"; false; }
  # Pinned logon is Interactive, not S4U: S4U cannot be registered unelevated (ADR-0803 Amd 1).
  echo "$output" | grep -q '^PINNED_LOGON:"Interactive"$' || { echo "$output"; false; }
}

@test "registerVerified: a correct readback is KEPT, not rolled back" {
  # The negative control for the three drift tests below. A registerVerified that unregistered
  # unconditionally would pass every one of them and leave the machine with no heartbeat -- the
  # rollback has to be a response to drift, not a habit.
  _run_case verify-ok
  echo "$output" | grep -q -F 'KEPT:["day-close-roll"]' || { echo "the good registration did not survive:"; echo "$output"; false; }
  echo "$output" | grep -q '^EXISTS:true$' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LOGON_BACK:"Interactive"' || { echo "$output"; false; }
}

@test "registerVerified: a setting that DRIFTS on readback unregisters the task" {
  # The OS is entitled to apply its own value. A task carrying an inherited
  # DisallowStartIfOnBatteries=true appears healthy in every listing and simply never fires on
  # battery -- so refusing loudly is not enough; the wrong task must not be left standing.
  _run_case verify-drift
  echo "$output" | grep -q '"code":"SETTINGS_DRIFT"' || { echo "$output"; false; }
  echo "$output" | grep -q '"rolledBack":true' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "a wrong task was left on the machine:"; echo "$output"; false; }
}

@test "registerVerified: a setting MISSING from the readback is drift, not a pass" {
  # An absent key must not compare equal to anything. This is the case a shape check waves
  # through: the object came back, it just no longer says whether the job catches up a missed run.
  _run_case verify-missing
  echo "$output" | grep -q '"code":"SETTINGS_DRIFT"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "$output"; false; }
}

@test "registerVerified: a task the OS will not report is rolled back too" {
  # register said ok and query says it does not exist. Something is wrong that neither call
  # admitted, and the safe reading of a disagreement about whether the heartbeat exists is OFF.
  _run_case verify-unseen
  echo "$output" | grep -q '"code":"NOT_REPORTED"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "$output"; false; }
}

@test "registerVerified: a dropped log redirect is drift, and the task comes off the machine" {
  # A registration is four things, and only the settings used to be verified. Task Scheduler
  # discards stdout and stderr, so the redirect IS the evidence a failing run leaves behind --
  # losing it silently means the first unattended failure has no trace at all.
  _run_case verify-action-drift
  echo "$output" | grep -q '"code":"ACTION_DRIFT"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "$output"; false; }
}

@test "registerVerified: a wrong working directory is drift too" {
  # A task that runs in the wrong directory finds no repo, no spine and no schedule -- and reports
  # a perfectly healthy registration while doing it.
  _run_case verify-cwd-drift
  echo "$output" | grep -q '"code":"CWD_DRIFT"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "$output"; false; }
}

@test "registerVerified: settings that were WRONG WHEN SENT blame the caller, not the OS" {
  # Comparing the readback straight against PINNED_SETTINGS validates one thing and compares
  # another: an OS that honoured a bad registration exactly would be reported as OS drift while
  # the real fault -- the caller -- was never named. And nothing reaches the machine.
  _run_case verify-unpinned-send
  echo "$output" | grep -q '"code":"UNPINNED_REGISTRATION"' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'LEFT_BEHIND:[]' || { echo "$output"; false; }
}

@test "task action: the line this repo would register RUNS, on a path containing a space" {
  # Windows only, and it registers nothing -- it runs the built command line the way Task
  # Scheduler runs it (one concatenated command line, verbatim) and checks what happens.
  #
  # Two shipped defects live here. The argv used to be joined with spaces into one unquoted
  # string, so a repo under a path with a space ran a truncated path every slot forever. And the
  # log directory used to be created at REGISTER time only -- delete it and cmd fails opening the
  # redirect BEFORE the job starts, so the job never runs and the mechanism added to make failures
  # visible is the one hiding this one.
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) : ;;
    *) skip "cmd.exe only exists on the Windows leg" ;;
  esac
  run node "$ARC_ROOT/tests/fixtures/jobs/action-line-harness.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
  echo "$output" | grep -q '^LOGDIR_BEFORE:false$' || { echo "the harness did not start from a missing log dir:"; echo "$output"; false; }
  # FIRST run: the directory does not exist and the action has to create it.
  echo "$output" | grep -q -F 'FIRST:{"exit":0,"stderr":"","dir":true,"body":"hi"}' \
    || { echo "the first run did not create its log dir and write to it:"; echo "$output"; false; }
}

@test "task action: it runs AGAIN when the log directory already exists" {
  # THE DEFECT THAT COST A PROVING WEEK, pinned.
  #
  # The action read `if not exist DIR md DIR & PROG`. `cmd` binds the entire remainder of the line
  # to the IF, so once the directory existed -- every run after the first -- the program never ran
  # and cmd exited 0. Task Scheduler recorded a successful run, no log was written because nothing
  # wrote one, and no receipt landed because nothing executed. Three days of scheduled runs were
  # no-ops reporting success.
  #
  # It shipped inside the FIX for a different finding, and the fixture that came with it tested
  # only the directory-MISSING branch -- the first run, which never happens again. The failure
  # path was covered and the normal path was not.
  #
  # Parenthesising does not help: `if not exist DIR (md DIR) & PROG` was measured and fails the
  # same way. The conditional is gone entirely.
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) : ;;
    *) skip "cmd.exe only exists on the Windows leg" ;;
  esac
  run node "$ARC_ROOT/tests/fixtures/jobs/action-line-harness.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q -F 'SECOND:{"exit":0,"stderr":"","dir":true,"body":"hi"}' \
    || { echo "the second run did nothing -- the job would report success forever:"; echo "$output"; false; }
  # And the guard against the shape returning: no conditional in the built command line at all.
  if grep -n 'if not exist' "$ARC_ROOT/.claude/scripts/hq/lib/jobs/scheduler-os.mjs" | grep -v '^\s*[0-9]*: *//' | grep -q 'argument:'; then
    echo "a conditional is back in the task action line"
    false
  fi
}

@test "jobs-contract: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}
