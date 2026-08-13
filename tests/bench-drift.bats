#!/usr/bin/env bats
# Phase 03 -- the drift guard: two split comparability axes, cost-delta classification, three
# alert tiers, muted classes, and the anti-goalpost clause.
#
# The checks live in tests/bench-drift-probe.mjs. Not inline for the usual reason: they carry
# apostrophes, backticks and `$`, and CLAUDE.md forbids all three in a shell-embedded program.
#
# Its own file so it lands in its own shard and runs concurrently with the other bench probes.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41).
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

setup_file() {
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # set +e: bats runs setup_file under errexit, so a non-zero probe would abort it before the
  # status line is written and the file would fail with a shell trace instead of the assertion.
  set +e
  node "$ARC_ROOT/tests/bench-drift-probe.mjs" > "$BATS_FILE_TMPDIR/drift.out" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/drift.status"
  set -e
}

D() { cat "$BATS_FILE_TMPDIR/drift.out"; }
D_STATUS() { cat "$BATS_FILE_TMPDIR/drift.status"; }

@test "the drift probe passes every check" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"all checks held"* ]]
}

@test "the drift probe is not vacuous: it reports its own check count" {
  [ "$(D_STATUS)" -eq 0 ]
  local oks
  oks="$(D | grep -c '^ok ')"
  [ "$oks" -ge 40 ]
}

@test "quality and cost comparability fail independently" {
  # Collapsing the two into one boolean is how a bookkeeping gap silently disables a real
  # regression check: a driver-version bump breaks quality while cost stays perfectly comparable,
  # and a missing token count does the reverse.
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok a driver-version change breaks quality comparability only"* ]]
  [[ "$(D)" == *"ok an absent token count breaks cost comparability only"* ]]
}

@test "a price rise is never reported as a usage change" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok identical tokens with more money is a PROVIDER-RATE change"* ]]
  [[ "$(D)" == *"ok more tokens at an unchanged per-token rate is a TOKEN-USE change"* ]]
  [[ "$(D)" == *"ok both moving is UNKNOWN-MIXED, not the more convenient of the two"* ]]
}

@test "a cost delta is never hidden behind an incomparable baseline" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok an incomparable baseline yields UNKNOWN-MIXED with its reason, never a silent number"* ]]
}

@test "each alert tier is proven by its own fixture" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok tier 1 fires on a new schema failure"* ]]
  [[ "$(D)" == *"ok tier 2 fires on a big drop across two failing fixtures"* ]]
  [[ "$(D)" == *"ok tier 3 fires on a cost increase above the threshold"* ]]
}

@test "tier 3 is report-only and never becomes an inbox item" {
  # An inbox that fills with price movements is an inbox nobody reads, which is how a tier-1
  # schema failure goes unnoticed.
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok and it is REPORT-ONLY even at 500 percent -- never an inbox item"* ]]
}

@test "tier 2 needs BOTH its conditions, never either alone" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok a big drop concentrated in ONE fixture is one fixture, not drift"* ]]
  [[ "$(D)" == *"ok a drop below 10pp does not fire tier 2"* ]]
}

@test "a class below the fixture floor is muted and the report says why" {
  # Silence that looks like no-drift is worse than no report at all.
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok a class below 5 fixtures is MUTED"* ]]
  [[ "$(D)" == *"ok and the report says why it is muted"* ]]
}

@test "a score movement alone never re-pins the baseline" {
  # The anti-goalpost clause. A champion that quietly got worse would otherwise become its own
  # new standard and the guard would report no drift forever after.
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok a score collapse alone does NOT license a re-pin"* ]]
  [[ "$(D)" == *"ok a quality-compatibility change DOES"* ]]
  [[ "$(D)" == *"ok a merged routing change DOES"* ]]
  [[ "$(D)" == *"ok the cause list is closed at those two"* ]]
}

@test "a clean guard run leaves no approval on the spine" {
  # ADR-0910: the spine never carries no-op approvals, and "no approval appeared" and "the guard
  # did not run" must not look the same in a log.
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok a clean guard run leaves NO approval on the spine"* ]]
  [[ "$(D)" == *"ok but it DOES leave its run.completed"* ]]
  [[ "$(D)" == *"ok and states that NO approval event was created"* ]]
}

@test "a drifting guard run creates exactly one approval with gate drift" {
  [ "$(D_STATUS)" -eq 0 ]
  [[ "$(D)" == *"ok and creates exactly ONE approval.requested"* ]]
  [[ "$(D)" == *"ok whose gate is drift, not router-merge"* ]]
  [[ "$(D)" == *"ok nothing was quarantined"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 13 ]
}
