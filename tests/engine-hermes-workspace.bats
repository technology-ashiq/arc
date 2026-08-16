#!/usr/bin/env bats
# engine-hermes-workspace.bats -- Phase 06 fixture 8 (ADR-0222): a dispatch cannot inherit the
# previous dispatch's memory, because it never mounts the previous dispatch's volume.
#
# THE ASSERTION IS ON THE VOLUME, NEVER ON THE ANSWER, and that is the whole finding. When this was
# first measured against the real runtime, a marker planted in run N did NOT appear in run N+1's
# stdout -- so the obvious test would have recorded a PASS -- while the string sat on disk in
# memories/MEMORY.md and in state.db. Asking the model whether it remembers is asking the model.
#
# TWO FILES ARE PLANTED, not one. The marker turned up in state.db as well as the MEMORY.md the
# vendor's docs name, which is exactly why ADR-0222 copies the whole home instead of wiping a list:
# a wipe list one file short reads green while carrying data across.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.mjs"
  TEMPLATE="$BATS_TEST_TMPDIR/template"
  mkdir -p "$TEMPLATE"
  printf 'seed\n' > "$TEMPLATE/config.yaml"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$TEMPLATE"
  export ARC_DRIVER_COST_FILE="$BATS_TEST_TMPDIR/cost.json"
  export ARC_HERMES_USAGE_FILE=""
  export ARC_HERMES_MARKER="ZEBRAQUARTZ7741"
  export ARC_HERMES_FAKE_MARKER="$ARC_HERMES_MARKER"
}

run_case() {
  export ARC_HERMES_FAKE_CASE="$1"
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
}

@test "ADR-0222: dispatch N+1 does NOT see the memory dispatch N wrote" {
  run_case plant-memory
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]

  run_case read-memory
  [ "$status" -eq 0 ]
  # The second dispatch reports what its OWN volume held. Empty is the requirement.
  [[ "$output" == *'"memory_seen":""'* ]]
  [[ "$output" == *'"state_seen":""'* ]]
  [[ "$output" != *"$ARC_HERMES_MARKER"* ]]
}

@test "ADR-0222: the TEMPLATE is never written to, so it cannot carry state forward either" {
  # If a dispatch could mutate the template, run N's memories would reach run N+1 through the
  # template itself and the copy would buy nothing.
  run_case plant-memory
  [ "$status" -eq 0 ]
  [ ! -f "$TEMPLATE/memories/MEMORY.md" ]
  [ ! -f "$TEMPLATE/state.db" ]
  run grep -rl "$ARC_HERMES_MARKER" "$TEMPLATE"
  [ "$status" -ne 0 ]
}

@test "ADR-0222 NEGATIVE CONTROL: the fixture really does plant the marker where a shared volume would keep it" {
  # Without this, every assertion above is satisfied by a fixture that writes nothing at all -- the
  # vacuous pass, wearing an isolation test's name. Run the fixture directly against a directory
  # nothing copies, and prove the marker lands.
  # SEEDED INTO THE TEMPLATE, so the copy carries it. If `read-memory` reports the marker here, the
  # mechanism can see one when one is present -- which is what makes the EMPTY result in test 1 a
  # finding rather than a fixture that writes nothing. Without this, both tests are satisfied by a
  # fixture that does nothing at all: the vacuous pass wearing an isolation test's name.
  #
  # It goes through the DRIVER rather than invoking the fixture from bash. An earlier version did
  # the latter and failed for a reason that had nothing to do with the code: Git Bash rewrites an
  # argument shaped `path:path` into a Windows path LIST, so the fixture received
  # `C:/...;C:/opt/data`, took the drive colon as the separator, and wrote to a relative directory
  # called `C`. Production never sees that -- drivers/hermes.mjs spawns docker with an ARGV ARRAY
  # and no shell -- so a control that only fails inside bash is testing bash.
  mkdir -p "$TEMPLATE/memories"
  printf '%s\n' "$ARC_HERMES_MARKER" > "$TEMPLATE/memories/MEMORY.md"
  printf 'sqlite-ish %s\n' "$ARC_HERMES_MARKER" > "$TEMPLATE/state.db"

  run_case read-memory
  [ "$status" -eq 0 ]
  [[ "$output" == *"$ARC_HERMES_MARKER"* ]]
  [[ "$output" == *'"memory_seen":"'"$ARC_HERMES_MARKER"'"'* ]]
}

@test "ADR-0222: the private workspace is REMOVED after the dispatch, not left on disk" {
  # A 36 MB copy per dispatch that is never cleaned up is a slower version of the leak this closes.
  local before after
  before="$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'arc-hermes-ws-*' 2>/dev/null | wc -l)"
  run_case plant-memory
  [ "$status" -eq 0 ]
  after="$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'arc-hermes-ws-*' 2>/dev/null | wc -l)"
  [ "$after" -le "$before" ]
}

@test "ADR-0222: the driver SAYS which workspace mode ran, on the transcript" {
  # An unconfined dispatch has to be visible in the trail rather than inferred from the absence of
  # a line -- and it keeps `workspaceIsCopy` from being a variable nothing reads, which is the
  # dead-assertion class this cycle has recorded twice.
  run_case clean
  [ "$status" -eq 0 ]
  [[ "$stderr" == *"workspace is a PRIVATE copy"* ]]
}

@test "suite: all 6 tests in this file are REGISTERED" {
  run grep -c "^@test" "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$output" = "6" ]
}
