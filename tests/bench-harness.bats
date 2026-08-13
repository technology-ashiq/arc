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

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41), so an empty value still redirects
  # rather than silently falling through to the repo spine.
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

# ---------------------------------------------------------------------------
# slice 09 -- the steel thread.
#
# The probe spawns two full bench runs, and each run shells out to arc-run five times, so running
# it once per @test would put ten minutes into a Windows shard for one file. It runs ONCE in
# setup_file and every test reads the cached output -- which also means each test asserts on the
# SAME run rather than on its own, so a flaky ordering cannot make two tests disagree.
# ---------------------------------------------------------------------------

setup_file() {
  export BATS_STEEL_OUT="$BATS_FILE_TMPDIR/steel.out"
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # Status captured to its own file: a probe piped anywhere reports the exit code of the LAST
  # stage, and a masked red suite is worse than no suite (.claude/rules/testing.md).
  # set +e around it, deliberately. bats runs setup_file under errexit, so a probe that exits
  # non-zero ABORTS setup_file before the status line is ever written -- the whole file then fails
  # with a shell trace instead of the assertion that was supposed to report it. The status is
  # captured and asserted; nothing is swallowed.
  set +e
  node "$ARC_ROOT/tests/bench-steel-probe.mjs" > "$BATS_STEEL_OUT" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/steel.status"
  set -e
}

STEEL() { cat "$BATS_FILE_TMPDIR/steel.out"; }
STEEL_STATUS() { cat "$BATS_FILE_TMPDIR/steel.status"; }

@test "the steel thread probe passes every check" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"all checks held"* ]]
}

@test "the steel probe is not vacuous: it reports its own check count" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  local oks
  oks="$(STEEL | grep -c '^ok ')"
  [ "$oks" -ge 38 ]
}

@test "the receipt is verified present in events and absent from quarantine" {
  # THE assertion the slice hangs on. Exit 0 from a fire-and-forget writer is not evidence that
  # anything was written -- retro-log 2026-08-02, an emitter reported success while every receipt
  # it produced sat quarantined.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok exactly ONE run.completed was emitted by bench"* ]]
  [[ "$(STEEL)" == *"ok nothing was quarantined on the happy path"* ]]
  [[ "$(STEEL)" == *"ok a quarantined id is found in a NESTED quarantine dir and is not a landing"* ]]
}

@test "a run never claims a model it did not apply" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok the receipt records the model REQUESTED"* ]]
  [[ "$(STEEL)" == *"ok and records that NO model was applied"* ]]
}

@test "M1 is corrected by measurement: two of its three env vars do not survive arc-run" {
  # arc-run.mjs:378-381 rebuilds the driver environment and overwrites ARC_ROOT and
  # ARC_DRIVER_MODEL; only ARC_MOCK_FIXTURE passes through. Asserted behaviourally rather than by
  # grepping the source, so the day the engine grows a target-repo seam this fails loudly.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok MEASURED: arc-run overwrites ARC_ROOT, so a bogus one does not reach the driver"* ]]
  [[ "$(STEEL)" == *"ok MEASURED: arc-run overwrites ARC_DRIVER_MODEL, so its receipts read unpinned"* ]]
}

@test "a failing attempt is reported, not rounded up to a pass" {
  # The negative control. A runner whose only exercised path is the happy one has an unmeasured
  # half, and a suite that only ever sees green cannot tell green from unconditional.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a run with no usable recordings exits 1, not 0"* ]]
  [[ "$(STEEL)" == *"ok with nothing scored the assertion rate is ABSENT, never 100 percent"* ]]
  [[ "$(STEEL)" == *"ok a failed run still emits its receipt, with outcome fail"* ]]
  [[ "$(STEEL)" == *"ok the driver reason reached the receipt intact, path separators and all"* ]]
}

@test "the closed flag set is enforced and an ignored flag is refused instead" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok an unknown driver is exit 2 and names the installed set"* ]]
  # A budget dimension nothing reads is not a bound: `rupees=1` parses and enforces nothing.
  [[ "$(STEEL)" == *'ok parseArgs refuses "--driver mock --budget rupees=1"'* ]]
  # `--propose` alone is refused for a SHARPER reason since Phase 02: there is no proposal
  # without an incumbent, because every gate past the first is a comparison against it.
  [[ "$(STEEL)" == *'ok parseArgs refuses "--driver mock --budget inr=1 --propose"'* ]]
  [[ "$(STEEL)" == *"ok --champion alone is now the drift guard, not a refusal"* ]]
}

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
  [ "${#BATS_TEST_NAMES[@]}" -eq 14 ]
}
