#!/usr/bin/env bats
# Phase 01 -- bench core: the canonical encoder, K-group admission control, post-call
# reconciliation, and the replay proof.
#
# ONE file rather than the two the phase spec's verification plan names (`bench-budget.bats` and
# `bench-replay.bats`). The checks all live in tests/bench-core-probe.mjs, and that probe spawns a
# full K=3 run; splitting it across two bats files would run it twice for no additional coverage,
# and each extra file also reshuffles the shard plan. The DEVIATION is recorded here rather than
# left for a reader to notice: same assertions, same probe, one file.
#
# The checks are not inline for the usual reason -- they need apostrophes, backticks and `$` in
# regexes, and CLAUDE.md forbids all three in a program embedded in a shell string.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41).
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

setup_file() {
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # Redirected to a file and the status captured separately: a probe piped anywhere reports the
  # exit code of the LAST stage, and a masked red suite is worse than no suite
  # (.claude/rules/testing.md).
  # set +e: bats runs setup_file under errexit, so a non-zero probe would abort it before the
  # status line is written and the file would fail with a shell trace instead of the assertion.
  set +e
  node "$ARC_ROOT/tests/bench-core-probe.mjs" > "$BATS_FILE_TMPDIR/core.out" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/core.status"
  set -e
}

CORE() { cat "$BATS_FILE_TMPDIR/core.out"; }
CORE_STATUS() { cat "$BATS_FILE_TMPDIR/core.status"; }

@test "the bench core probe passes every check" {
  # PRINT THE PROBE ON FAILURE. The tests read a cached file, so without this a red probe on CI
  # shows only a failed comparison and none of the reason -- the diagnosis then costs a whole
  # extra cycle, which is exactly what happened on 2026-08-13.
  [ "$(CORE_STATUS)" -eq 0 ] || { CORE; false; }
  # A positive end marker the probe prints only after the last check, so a crash part-way through
  # cannot read as a pass.
  [[ "$(CORE)" == *"all checks held"* ]]
}

@test "the core probe is not vacuous: it reports its own check count" {
  [ "$(CORE_STATUS)" -eq 0 ]
  local oks
  oks="$(CORE | grep -c '^ok ')"
  # 87 measured 2026-08-17. Tightened from a floor of 55 against an actual of ~84: at that slack
  # a whole section could be deleted without the count moving, which is the one thing this test
  # exists to notice.
  [ "$oks" -eq 87 ]
}

@test "the canonical encoder refuses NaN rather than folding it to null" {
  # Under JSON.stringify this passes silently while producing a colliding hash, which is why the
  # assertion is on the REFUSAL and not on the hash.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok the encoder refuses NaN rather than folding it to null"* ]]
  [[ "$(CORE)" == *"ok the encoder refuses undefined"* ]]
  [[ "$(CORE)" == *"ok the encoder refuses BigInt"* ]]
  [[ "$(CORE)" == *"ok the encoder refuses a cycle"* ]]
}

@test "the encoder is type-tagged, so two different documents cannot hash alike" {
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok a number and its string do not encode alike"* ]]
  [[ "$(CORE)" == *"ok length prefixes stop a string from impersonating a structure"* ]]
  [[ "$(CORE)" == *"ok 0 and -0 are different documents"* ]]
}

@test "a group that cannot be covered never starts" {
  # The proof is the ABSENCE of arc-run receipts, not the presence of the word refused: an
  # assertion on the printed message would pass just as well against a run that spent the money
  # and then said so.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok NOT ONE arc-run invocation happened"* ]]
  [[ "$(CORE)" == *"ok every fixture is refused with failure: budget"* ]]
  [[ "$(CORE)" == *"ok and the class reads NO PROPOSAL"* ]]
}

@test "budget exhaustion does not trigger the fallback chain" {
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok no fallback driver was invoked either"* ]]
  [[ "$(CORE)" == *"ok a missing ceiling REFUSES the group"* ]]
}

@test "a measured cost above its reservation corrects the remainder" {
  # The assertion is on a LATER fixture being refused. An implementation that reconciled nothing
  # would have admitted three groups off the stale reservation and invoked nine times.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok only the FIRST group ran before the corrected remainder refused the rest"* ]]
  [[ "$(CORE)" == *"ok a later fixture is refused, and the refusal names the PROCESS sub-cap that actually bound"* ]]
  [[ "$(CORE)" == *"ok an ABSENT measurement leaves the reservation standing"* ]]
}

@test "K attempts are never collapsed into one per-fixture verdict" {
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok a 2-of-3 and a 1-of-3 do not report the same median"* ]]
  [[ "$(CORE)" == *"ok the spread travels with the median"* ]]
  [[ "$(CORE)" == *"ok K=3 is visible per fixture on the scorecard"* ]]
}

@test "schema pass-rate and assertion pass-rate are reported separately" {
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok schema pass-rate is reported SEPARATELY from assertion pass-rate"* ]]
  [[ "$(CORE)" == *"ok an empty sample reports ABSENT, never 0"* ]]
}

@test "a ceiling value never appears in any emitted payload" {
  # The test caps are deliberately odd numbers that appear nowhere else, so the search cannot
  # false-positive on an unrelated 500 or 100.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok no ceiling value appears anywhere in the emitted receipt"* ]]
  [[ "$(CORE)" == *"ok the caps stay in the local provenance file"* ]]
}

@test "the provenance tuple keeps subject and fingerprint as siblings" {
  # ADR-0903: MP-F's nine fields stay MP-F's, and the driver rides beside them rather than inside.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok subject and fingerprint are SIBLING blocks"* ]]
  [[ "$(CORE)" == *"ok an unapplied model leaves no model_id key at all"* ]]
  [[ "$(CORE)" == *"ok request_settings is absent rather than a claimed temperature"* ]]
}

@test "re-scoring captured outputs is byte-identical" {
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok REPLAY IS BYTE-IDENTICAL"* ]]
  [[ "$(CORE)" == *"ok re-ordering keys inside a captured output leaves the scorecard byte-identical"* ]]
  [[ "$(CORE)" == *"ok a replay emits NO event of any kind"* ]]
}

@test "a normalizer bump is stale-format, and a tamper is a mismatch" {
  # Different facts, different exit codes. Reporting a normalizer bump as a mismatch sends someone
  # hunting a corruption that never happened.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok a normalizer bump reports STALE-FORMAT on its own exit code 3"* ]]
  [[ "$(CORE)" == *"ok a tampered scorecard is a MISMATCH, not stale-format"* ]]
}

@test "a process declaring no evals is discovered as zero fixtures, not a crash" {
  # WATCHED BY NAME because it was not, and that is how it went vacuous. The check used to filter
  # the real tree for zero-fixture classes; the only two were another lane's job stubs, so when
  # discovery correctly stopped returning stubs the filter went empty and `[].every()` kept the
  # check green while it measured nothing. Nothing in any bats file was matching the line, so the
  # ok-count floor absorbed it without a word. Its subject is now a tree the probe BUILDS.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok a process declaring no evals is DISCOVERED, not a startup crash"* ]]
  [[ "$(CORE)" == *"ok and reports zero fixtures rather than throwing"* ]]
}

@test "a refusal names the cap that actually bound, and a breached ceiling is reported" {
  # Both were silent failures of the same kind: the run knew something the operator was not told.
  # One hardcoded sentence named the RUN cap for both exhaustion branches -- false for its own
  # fixture, whose run cap has 880 of 1000 left -- and ceilings.json now makes the PROCESS sub-cap
  # the binding constraint on every real pair, so the wrong number would have been raised. And a
  # measured spend above a hand-authored reservation is the ONE observation proving the ceiling
  # was a bad guess; it was absorbed without a line.
  [ "$(CORE_STATUS)" -eq 0 ]
  [[ "$(CORE)" == *"ok a later fixture is refused, and the refusal names the PROCESS sub-cap that actually bound"* ]]
  [[ "$(CORE)" == *"ok and it does not blame the run cap, which had 880 of 1000 left"* ]]
  [[ "$(CORE)" == *"ok a measured spend above the reservation is REPORTED, not silently absorbed"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 16 ]
}
