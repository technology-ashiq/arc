#!/usr/bin/env bats
# org Cycle 20 Phase 02 -- a public skill reaches a role only pinned, vetted and on a proposal branch (REQ-04, ADR-1628).
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "skill-import: the vet, the source and the command run every check clean" {
  run node "$ARC_ROOT/tests/org/skill-import.mjs"
  [[ "$output" == *"RAN skill-import "* ]] || { echo "the fixture never ran: $output"; false; }
  [[ "$output" == *", 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}
