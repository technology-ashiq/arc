#!/usr/bin/env bats
# org Cycle 20 Phase 04 -- the face contract gates refuse a duplicate JSON key (REQ-06, ADR-1630).
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "dup-keys: face-sections and face-coverage fail by name on each contract file holding a key twice" {
  run node "$ARC_ROOT/tests/org/dup-keys.mjs"
  [[ "$output" == *"RAN dup-keys "* ]] || { echo "the fixture never ran: $output"; false; }
  [[ "$output" == *", 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}
