#!/usr/bin/env bats
# org Cycle 20 Phase 03 -- hire-to-own: a hired seat becomes an own agent in one branch (REQ-05, ADR-1629).
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "org-own: the card rewrite and the command run every check clean" {
  run node "$ARC_ROOT/tests/org/own.mjs"
  [[ "$output" == *"RAN own "* ]] || { echo "the fixture never ran: $output"; false; }
  [[ "$output" == *", 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}
