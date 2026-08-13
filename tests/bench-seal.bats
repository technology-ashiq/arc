#!/usr/bin/env bats
# Phase 04 -- the seal: two RUNNING mutants, the system-level adversarial fixtures, the redaction
# sweep, and partial-failure evidence preservation.
#
# THE MUTANTS ARE RUN, NOT GREPPED. retro-log 2026-08-04 records a grep-based propose-only guard
# that a mutant overwriting the canonical file, deleting the champion, committing and spawning a
# deploy walked straight past. Each mutant here is a patched COPY of arc-bench.mjs executed inside
# a sandbox root; the real tree is never written to.
#
# The checks live in tests/bench-seal-probe.mjs -- not inline, for the usual reason.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41).
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

setup_file() {
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # set +e: bats runs setup_file under errexit, so a non-zero probe would abort it before the
  # status line is written and the file would fail with a shell trace instead of the assertion
  # that was supposed to report it. That is exactly how this suite went red on 2026-08-13.
  set +e
  node "$ARC_ROOT/tests/bench-seal-probe.mjs" > "$BATS_FILE_TMPDIR/seal.out" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/seal.status"
  set -e
}

S() { cat "$BATS_FILE_TMPDIR/seal.out"; }
S_STATUS() { cat "$BATS_FILE_TMPDIR/seal.status"; }

@test "the seal probe passes every check" {
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"all checks held"* ]]
}

@test "the seal probe is not vacuous: it reports its own check count" {
  [ "$(S_STATUS)" -eq 0 ]
  local oks
  oks="$(S | grep -c '^ok ')"
  [ "$oks" -ge 28 ]
}

@test "the router-write mutant is REJECTED, and it really did write" {
  # Attributability first: a mutant that crashed on a bad arg before ever writing would produce
  # the same non-zero exit and prove nothing at all.
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok MUTANT A actually wrote the router -- the negative control is real"* ]]
  [[ "$(S)" == *"ok and the guard REJECTED the run"* ]]
  [[ "$(S)" == *"ok naming propose-only, not some unrelated fault"* ]]
  [[ "$(S)" == *"ok and the rejection is bench's own rule, not a crash"* ]]
}

@test "the direct-spawn mutant is REJECTED for BENCH's reason, not the policy gate's" {
  # ADR-0912's correction: a direct spawn is already policed by common.mjs:156-168, so being
  # stopped there proves nothing about what it actually breaks -- the run-level budget remainder,
  # the run.completed receipt and the contract-retry ladder.
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok MUTANT B's direct spawn actually produced scored attempts"* ]]
  [[ "$(S)" == *"ok for BENCH's own reason: no arc-run receipt"* ]]
  [[ "$(S)" == *"ok and it cites M1, the rule it broke"* ]]
  [[ "$(S)" == *"ok NOT because policy stopped it -- that would prove nothing about budget or receipts"* ]]
}

@test "the unmutated sandbox is the control, and it is clean" {
  # Without this, both mutant rejections could be passing on a base that was already broken.
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok the unmutated sandbox raises no propose-only violation"* ]]
  [[ "$(S)" == *"ok and no invocation violation"* ]]
  [[ "$(S)" == *"ok and its attempts DID leave arc-run receipts"* ]]
}

@test "one failed fixture never erases the rest of the run's evidence" {
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok every OTHER fixture still scored"* ]]
  [[ "$(S)" == *"ok and it preserves the surviving fixtures' evidence"* ]]
  [[ "$(S)" == *"ok while the broken one contributes ZERO to the denominator, not a zero score"* ]]
}

@test "a malformed eval output does not crash the run" {
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok a malformed recording does not crash the run"* ]]
  [[ "$(S)" == *"ok the broken fixture is reported NOT SCORED"* ]]
  [[ "$(S)" == *"ok and the class reads NO PROPOSAL rather than a number built on a hole"* ]]
}

@test "an unknown model is recorded as requested and never as applied" {
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok an unknown model id is recorded as REQUESTED and never as applied"* ]]
}

@test "the K-group budget boundary is exact in both directions" {
  # Off-by-one here is the difference between refusing a group that would have fit and admitting
  # one that will not.
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok a group costing EXACTLY the remaining cap is admitted"* ]]
  [[ "$(S)" == *"ok a group one rupee over the cap is refused before it starts"* ]]
  [[ "$(S)" == *"ok the reservation scales with K, not with the invocation"* ]]
}

@test "a planted key appears in no stored artifact" {
  [ "$(S_STATUS)" -eq 0 ]
  [[ "$(S)" == *"ok artifacts were actually written, so the sweep is not vacuous"* ]]
  [[ "$(S)" == *"ok the planted key appears in NO stored artifact"* ]]
  [[ "$(S)" == *"ok and the sweep covered the scorecard, the provenance and the captures"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 11 ]
}
