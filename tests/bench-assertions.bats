#!/usr/bin/env bats
# Phase 00 slice 04 -- the assertion substrate (ADR-0905).
#
# The checks themselves live in tests/bench-assertions-probe.mjs, not inline here. They need
# apostrophes, backticks and `$` in regexes and messages, and CLAUDE.md is explicit that a
# program embedded in a shell string carries none of the three -- a rule this repo has broken
# four times, twice inside the comment explaining the previous break.
#
# This wrapper asserts the probe RAN (exit status) and that it reached its end marker, rather
# than asserting on the absence of a string, which a crash would satisfy.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/bench-assertions-probe.mjs"; }

@test "the assertion substrate probe passes every check" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  # A positive marker the probe prints only after the last check, so a crash mid-way cannot
  # look like a pass (.claude/rules/testing.md -- the vacuous pass).
  [[ "$output" == *"all checks held"* ]]
}

@test "the probe is not vacuous: it reports its own check count" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  # A probe that silently ran zero checks would exit 0 with no ok lines. Count them.
  local oks
  oks="$(printf '%s\n' "$output" | grep -c '^ok ')"
  [ "$oks" -ge 25 ]
}

@test "a fixture with no assertions scores ABSENT, never 100 percent" {
  # Pinned separately from the probe because it is the rule the whole substrate exists to
  # protect: retro-log 2026-07-30 -- a pass condition that is only an absence cannot detect
  # mediocrity, and treating no-assertions as all-passed would make adding none the cheapest
  # way to look perfect.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok no assertions reports an ABSENT rate, not 100 percent"* ]]
}

@test "an unknown assertion op is refused, not skipped" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok unknown op is refused"* ]]
}

@test "process-lint still validates all three processes after the pack.json addition" {
  # Slice 05. The No-gos claim the assertion schema is additive and leaves process-lint
  # untouched. retro-log 2026-08-02: a stated control is not a control until something asserts
  # it -- so this RUNS the lint rather than trusting the claim.
  #
  # pack.json is a SIBLING of the fixtures precisely so the frozen TOP_LEVEL_KEYS
  # (process-lint.mjs:65-67) never grows a key. process-lint contains a literal control byte
  # and reads as binary to grep, so searching it needs `grep -a`.
  run node "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs" --all
  [ "$status" -eq 0 ]
  # Assert it RAN and reached its verdict, not merely that it printed no error: an assertion
  # shaped "output does not contain X" is satisfied by a crash (.claude/rules/testing.md).
  [[ "$output" == *"all checks passed"* ]]
  [[ "$output" == *"3 file(s)"* ]]
}

# ---------------------------------------------------------------------------
# slice 07 -- commit-msg-draft armed to the MIN_FIXTURES floor.
#
# These live here rather than in a new .bats file on purpose. The shard plan is computed from
# the FILE LIST plus weights, so a new file reshuffles it -- which is exactly what turned CI red
# on slice 06 and exposed three unrelated scanner tests. Adding tests to a file that already has
# a weight leaves the plan stable.
# ---------------------------------------------------------------------------

ARMED() { echo "$ARC_ROOT/tests/bench-armed-probe.mjs"; }

@test "the armed commit-msg-draft class passes every check" {
  run node "$(ARMED)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"all checks held"* ]]
}

@test "every armed fixture satisfies its OWN assertions" {
  # A fixture whose recorded `expected` fails its own rules asserts something nobody could ever
  # pass, and would read as a permanent model failure rather than a broken fixture.
  run node "$(ARMED)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok single-file-fix: its own expected satisfies its own assertions"* ]]
  [[ "$output" == *"ok delete-and-add: its own expected satisfies its own assertions"* ]]
}

@test "the five armed repo states genuinely differ from one another" {
  # Otherwise they are five samples of ONE case -- the K dimension wearing five names, which is
  # the whole failure the fixture-repo harness exists to prevent.
  run node "$(ARMED)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok all five work trees differ from one another"* ]]
}

@test "commit-msg-draft clears the fixture floor and the other classes do not" {
  run node "$(ARMED)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok commit-msg-draft is now coverage-eligible"* ]]
  [[ "$output" == *"ok review-diff still reads NO PROPOSAL"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 10 ]
}
