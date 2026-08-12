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

@test "scheduler-os: a weekdays cadence becomes a Mon-Fri trigger, not a daily one" {
  _run_case roundtrip
  echo "$output" | grep -q 'WEEKDAY_TRIGGER:"weekly:MON,TUE,WED,THU,FRI@06:00"' || { echo "$output"; false; }
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

@test "jobs-contract: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}
