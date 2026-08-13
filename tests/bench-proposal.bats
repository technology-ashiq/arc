#!/usr/bin/env bats
# Phase 02 -- the router proposal: gates-first eligibility, three artifacts, and a diff bench can
# never apply itself.
#
# The checks live in tests/bench-proposal-probe.mjs. They are not inline for the usual reason:
# they carry apostrophes, backticks and `$` in regexes, and CLAUDE.md forbids all three in a
# program embedded in a shell string.
#
# A SEPARATE file from bench-core.bats, deliberately. Both probes spawn full K=3 runs, and two
# files land in two shards and run CONCURRENTLY where one file would run them back to back.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41).
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

setup_file() {
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # Redirected to a file and the status captured separately: a probe piped anywhere reports the
  # exit code of the LAST stage, and a masked red suite is worse than no suite.
  # set +e: bats runs setup_file under errexit, so a non-zero probe would abort it before the
  # status line is written and the file would fail with a shell trace instead of the assertion.
  set +e
  node "$ARC_ROOT/tests/bench-proposal-probe.mjs" > "$BATS_FILE_TMPDIR/prop.out" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/prop.status"
  set -e
}

PROP() { cat "$BATS_FILE_TMPDIR/prop.out"; }
PROP_STATUS() { cat "$BATS_FILE_TMPDIR/prop.status"; }

@test "the proposal probe passes every check" {
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"all checks held"* ]]
}

@test "the proposal probe is not vacuous: it reports its own check count" {
  [ "$(PROP_STATUS)" -eq 0 ]
  local oks
  oks="$(PROP | grep -c '^ok ')"
  [ "$oks" -ge 45 ]
}

@test "every one of the six gates can independently produce NO PROPOSAL" {
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok gate 1 fails on a fixture that never ran"* ]]
  [[ "$(PROP)" == *"ok gate 2 fails on a schema regression"* ]]
  [[ "$(PROP)" == *"ok gate 3 fails when the candidate loses by more than the band"* ]]
  [[ "$(PROP)" == *"ok gate 4 fails on too few DECLARED fixtures"* ]]
  [[ "$(PROP)" == *"ok gate 5 fails when only one side reports a cost"* ]]
  [[ "$(PROP)" == *"ok gate 6 fails when the two ran different eval-pack revisions"* ]]
}

@test "evidence-insufficient and candidate-lost never render identically" {
  # ADR-0906's headline rule. A reader who cannot tell them apart cannot tell "we have not
  # measured enough" from "we measured, and it lost".
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok evidence-insufficient and candidate-lost are DIFFERENT sentences"* ]]
  [[ "$(PROP)" == *"ok the two coverage sentences do not render identically"* ]]
  [[ "$(PROP)" == *"ok every NO PROPOSAL names the gate that produced it"* ]]
}

@test "the first failing gate is the one reported" {
  # A reader fixing the later failure would be fixing the wrong thing first.
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok the FIRST failing gate is the one reported"* ]]
}

@test "a schema failure is a scoreable outcome and does not fail completeness" {
  # A candidate that reliably breaks the contract is information, not an absence of it.
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok but a SCHEMA failure is a scoreable outcome and does not fail gate 1"* ]]
  [[ "$(PROP)" == *"ok gate 1 fails on an attempt with no scoreable outcome"* ]]
}

@test "the router diff is stable, pinned to a SHA, and carries no clock" {
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok the same inputs produce a BYTE-IDENTICAL diff"* ]]
  [[ "$(PROP)" == *"ok the diff is pinned to the router SHA the run read"* ]]
  [[ "$(PROP)" == *"ok no timestamp appears in the diff body"* ]]
}

@test "a class at NO PROPOSAL produces no diff at all" {
  # Never an empty or commented-out one, which would read as a proposal that happens to be blank.
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok the two ineligible classes produced NO diff file"* ]]
  [[ "$(PROP)" == *"ok proposing the incumbent yields NO diff at all, never an empty one"* ]]
  [[ "$(PROP)" == *"ok the ineligible classes appear in the table with their reason"* ]]
}

@test "all three artifacts are written and the table agrees with the manifest" {
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok artifact 1: the human evidence table exists"* ]]
  [[ "$(PROP)" == *"ok artifact 2: the machine-readable manifest exists"* ]]
  [[ "$(PROP)" == *"ok artifact 3: a diff exists for the proposed class"* ]]
  [[ "$(PROP)" == *"ok the table carries the manifest row for commit-msg-draft"* ]]
}

@test "approval.requested lands with gate router-merge" {
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok exactly one approval.requested was emitted"* ]]
  [[ "$(PROP)" == *"ok its gate is router-merge"* ]]
  [[ "$(PROP)" == *"ok nothing was quarantined"* ]]
}

@test "bench has no write path to the router" {
  # Propose-only. The file is byte-unchanged after a run that just proposed to change it.
  [ "$(PROP_STATUS)" -eq 0 ]
  [[ "$(PROP)" == *"ok engine/router.yaml is byte-unchanged after a proposing run"* ]]
  [[ "$(PROP)" == *"ok the manifest names the router SHA the run read"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 12 ]
}
