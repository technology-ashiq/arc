#!/usr/bin/env bats
# Phase 02 -- REQ-04: the unattended surface, and the interlock in front of it.
#
# THE CLAIM UNDER TEST is not "register works". It is the harder one: if the policy engine ever
# stops enforcing, the half of arc that runs while nobody is watching TURNS ITSELF OFF. A gate
# that only ever runs green is indistinguishable from no gate at all, so most of this file is
# about making it red on purpose and checking what it then refuses to do.
#
# TWO VACUOUS PASSES ARE DESIGNED AGAINST HERE, and both nearly happened:
#
#   1. `register` exits 2 on a non-Windows machine anyway, at the platform check. A fixture
#      asserting "a red gate exits 2" would therefore pass on two of the three CI legs WITHOUT
#      THE GATE HAVING RUN. So the gate is evaluated before the platform check, and every
#      assertion here reads the REASON out of stderr rather than the exit code alone.
#   2. A gate that is red for some unrelated reason would satisfy every red case in this file.
#      So `real-green` runs first and proves the gate is green against this repo unforced. It is
#      the negative control, and without it the rest of the file proves nothing.
bats_require_minimum_version 1.5.0
load 'test_helper'

GATE="$ARC_ROOT/tests/fixtures/jobs/gate-harness.mjs"
JOBS="$ARC_ROOT/.claude/scripts/hq/arc-jobs.mjs"

_gate() {
  run node "$GATE" "$1"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
}

# Windows is the only leg where `register` reaches an OS. The two tests that would drive the real
# Task Scheduler are skipped there rather than silently creating scheduled tasks on a CI runner.
_skip_on_windows() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) skip "drives the real Task Scheduler on this leg -- proven by hand in evidence/phase-02" ;;
  esac
}

# A NEGATIVE assertion, written as an `if` on purpose. The tempting one-liner
# `echo "$out" | grep -q X && { echo; false; }` returns 1 in BOTH directions under errexit -- once
# because the block ran, once because grep found nothing -- so it fails the test precisely when
# the code is correct. That is a vacuous pass wearing the costume of a strict check.
_refute() {
  if echo "$output" | grep -q -- "$1"; then
    echo "unwanted in output: $1"
    echo "$output"
    false
  fi
}

@test "policy gate: GREEN against this repo, unforced -- the control for every red case below" {
  _gate real-green
  echo "$output" | grep -q -F 'FAILS:[]' \
    || { echo "the gate is red for an unrelated reason, so no red test in this file means anything:"; echo "$output"; false; }
}

@test "policy gate: the test seam turns it red and names itself as the cause" {
  # The seam can only ADD a failure. If it could ever remove one it would be a one-variable disarm
  # of the unattended surface, which is the shape of a defect this repo has already shipped once.
  _gate forced-red
  echo "$output" | grep -q "ARC_JOBS_FORCE_POLICY_RED" || { echo "$output"; false; }
}

@test "policy gate: a root with no policy at all fails all three checks, not one" {
  # Each check has to be independently alive. A gate whose first failure short-circuits the other
  # two would report a valid law as merely unlinted.
  _gate no-policy
  echo "$output" | grep -q "policy-lint exited" || { echo "lint check did not fire:"; echo "$output"; false; }
  echo "$output" | grep -q "could not decide at all" || { echo "engine check did not fire:"; echo "$output"; false; }
  echo "$output" | grep -q "is not authorized" || { echo "per-job check did not fire:"; echo "$output"; false; }
}

@test "policy gate: policy-lint exiting non-zero is on its own enough to refuse" {
  # Everything else real, only the lint made to fail. A lint that is never red looks exactly like
  # a lint nobody reads.
  _gate lint-red
  echo "$output" | grep -q "policy-lint exited 1" || { echo "$output"; false; }
  # And ONLY that one. If a red lint dragged the other two checks red with it, this file could
  # not tell a broken lint apart from a broken engine.
  _refute "could not decide at all"
  _refute "is not authorized"
}

@test "policy gate: called without a root it refuses rather than guessing one" {
  _gate no-root
  echo "$output" | grep -q "without a root" || { echo "$output"; false; }
}

@test "register: a RED gate exits 2, says WHY, and registers nothing" {
  # The DoD's fail-closed fixture, driven through the real CLI on every leg. The reason is
  # asserted, not just the code -- see the header: exit 2 alone is ambiguous here.
  run env ARC_JOBS_FORCE_POLICY_RED=1 node "$JOBS" register day-close-roll
  [ "$status" -eq 2 ] || { echo "wanted exit 2, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "policy gate:" || { echo "refused for some other reason:"; echo "$output"; false; }
  echo "$output" | grep -q "fail-closed" || { echo "$output"; false; }
  _refute "arc-jobs: registered"
  # And it never reached the OS: the platform refusal is what a run that got past the gate prints,
  # so its ABSENCE is the proof that the gate is evaluated first.
  _refute "registration targets Windows"
}

@test "register: without the seam the gate PASSES, and the refusal comes from the platform" {
  # The other half of the control. If this printed the policy refusal too, the seam would not be
  # what made the previous test red and that test would prove nothing.
  _skip_on_windows
  run node "$JOBS" register day-close-roll
  [ "$status" -eq 2 ] || { echo "wanted exit 2 from the platform check, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "registration targets Windows" || { echo "$output"; false; }
  _refute "policy gate:"
}

@test "unregister: the OFF SWITCH is never gated by policy" {
  # A gate able to prevent turning the heartbeat OFF would hold the machine hostage rather than
  # protect it. Broken policy must still let everything be stopped.
  _skip_on_windows
  run env ARC_JOBS_FORCE_POLICY_RED=1 node "$JOBS" unregister day-close-roll
  _refute "policy gate:"
  echo "$output" | grep -q "registration targets Windows" || { echo "wanted the platform refusal, got:"; echo "$output"; false; }
}

@test "jobs-register: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}
