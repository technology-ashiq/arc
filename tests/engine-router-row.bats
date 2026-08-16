#!/usr/bin/env bats
# Phase 07, REQ-04 -- the four fields a runtime row must carry, enforced AT LOAD TIME.
#
# A runtime is hired, not installed. `cap:`, `hosted:`, `judge:` and `review_by:` are all four
# mandatory on a row that routes to an agent runtime, and a row missing any of them fails the
# router LOAD rather than the dispatch -- because a row that only fails when someone happens to
# route through it sits wrong for as long as nobody uses it.
#
# REQ-04 asks for hostile fixtures covering ABSENT, EMPTY, NULL and MALFORMED per field. That is
# SIXTEEN cases, not four: a near-miss that loads is a guard that cannot fail. `cap: ""` reads as
# decided and decides nothing; `cap: null` is a YAML VALUE rather than an omission; `cap: [x]` is
# the right word in the wrong shape.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/engine-router-row-probe.mjs"; }
RUN()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }

@test "router-row: the full 16-cell hostile matrix is covered and every cell refuses" {
  # Four fields times four malformed shapes. The matrix is enumerated in one place so a reader
  # can see that no cell is missing -- which is the property that actually matters here.
  run node "$(PROBE)" matrix
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"cells=16"* ]] || { echo "the matrix is not 16 cells: $output"; false; }
  [[ "$output" == *"MATRIX_COMPLETE"* ]] || { echo "$output"; false; }
}

@test "router-row: NEGATIVE CONTROL -- a sound row LOADS" {
  # Without this, every cell above is satisfied by a validator that refuses everything.
  run node "$(PROBE)" good
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GOOD_ROW_LOADS"* ]] || { echo "$output"; false; }
}

@test "router-row: an ordinary row carrying NONE of the four is untouched" {
  # This has to land as one reviewed diff, not as a rewrite of every row in the file.
  run node "$(PROBE)" untouched
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ordinary_faults=0"* ]] || { echo "$output"; false; }
}

@test "router-row: a PARTIAL row cannot sneak past by not being a runtime row" {
  # Someone adding `cap: L1-drafts` to an ordinary class and stopping there has written a row
  # that reads as capped and is not. Carrying ANY of the four means carrying all four.
  run node "$(PROBE)" untouched
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"partial_faults=3"* ]] || { echo "a partial row was accepted: $output"; false; }
  [[ "$output" == *"PARTIAL_CAUGHT"* ]] || { echo "$output"; false; }
}

@test "router-row: tenure expires strictly AFTER review_by, checked at the boundary" {
  # The boundary is the only interesting day, and it is only testable because the clock is a
  # parameter rather than new Date() inside the function.
  run node "$(PROBE)" tenure
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TENURE_BOUNDARY_CORRECT"* ]] || { echo "$output"; false; }
}

@test "router-row: a date that parses but does not exist is refused" {
  # 2026-02-31 passes a YYYY-MM-DD shape check and then compares as a real instant -- a tenure
  # nobody set, arrived at by arithmetic.
  run node "$(PROBE)" impossible-date
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"IMPOSSIBLE_DATE_REFUSED"* ]] || { echo "$output"; false; }
}

@test "router-row: the REAL engine/router.yaml loads clean" {
  # Without this the validator could be correct and the file it guards still broken.
  run node "$(PROBE)" real-router
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REAL_ROUTER_CLEAN"* ]] || { echo "$output"; false; }
}

@test "router-row: arc-run refuses to LOAD a router with a faulty row, not to dispatch" {
  # The layer is the point. Proven by pointing arc-run at a root whose router carries a partial
  # row: it must die at load, before it can report anything about routing.
  local root="$BATS_TEST_TMPDIR/fakeroot"
  mkdir -p "$root/engine" "$root/processes"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$root/processes/"
  cat > "$root/engine/router.yaml" <<'YAML'
version: 1
tiers:
  - balanced-workhorse
classes:
  commit-msg-draft:
    tier: balanced-workhorse
    driver: hermes
    cap: L1-drafts
YAML
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto --dry-run
  [ "$status" -ne 0 ] || { echo "a faulty router loaded: $output"; false; }
  [[ "$output" == *"will not load"* ]] || { echo "wrong failure: $output"; false; }
  [[ "$output" == *"hosted"* ]] || { echo "the missing field is not named: $output"; false; }
  [[ "$output" != *"would run"* ]] || { echo "it reached routing before failing: $output"; false; }
}

@test "this file registers every test it declares" {
  local n
  n="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$n" -eq 9 ] || { echo "declared $n tests, expected 9 - a test was added or silently dropped"; false; }
}
