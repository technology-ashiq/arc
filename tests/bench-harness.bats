#!/usr/bin/env bats
# Phase 00 slice 06 -- the fixture-repo harness (M3 / M11).
#
# `commit-msg-draft` declares `inputs: []`, so its real input is AMBIENT GIT STATE. Five fixtures
# sharing the input `{}` would be five samples of ONE case -- that is the K dimension, not five
# cases. What has to vary is the repository the driver sees, which is what this harness builds.
#
# The checks live in tests/bench-harness-probe.mjs, not inline: they need apostrophes and `$` in
# git porcelain strings, and CLAUDE.md forbids those in a shell-embedded program.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/bench-harness-probe.mjs"; }

@test "the fixture-repo harness probe passes every check" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  # A positive end marker, so a crash part-way cannot read as a pass.
  [[ "$output" == *"all checks held"* ]]
}

@test "the harness probe is not vacuous: it reports its own check count" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  local oks
  oks="$(printf '%s\n' "$output" | grep -c '^ok ')"
  [ "$oks" -ge 12 ]
}

@test "the overlaid change is UNSTAGED, because staging is the process own job" {
  # THE property this harness exists to guarantee. commit-msg-draft holds `git.op: add:*` and
  # `commit:*` -- its whole job is "stage related changes and write a conventional commit". A
  # pre-staged index would do that work for it and leave the model nothing to decide, which is
  # the fixture-that-measures-nothing failure this phase exists to avoid.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the change is UNSTAGED, not staged"* ]]
}

@test "the base tree is a real commit, so git diff has something to compare against" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the base is committed, exactly once"* ]]
}

@test "a refused materialization leaks no temp repo" {
  # A harness that only cleans up on success fills the runner disk exactly when something is
  # already going wrong.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok a refused materialization leaks no temp repo"* ]]
}

@test "a work tree can express a DELETION, and it lands unstaged" {
  # Slice 07's delete-and-add fixture is the one case where a draft built only from ADDED lines
  # describes half the change. Copying cannot remove a file, so work/ marks one with a
  # `<path>.arc-deleted` tombstone that the harness honours.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the tombstoned file is gone from the work tree"* ]]
  [[ "$output" == *"ok the deletion is visible and unstaged"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 7 ]
}
