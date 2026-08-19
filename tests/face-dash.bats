#!/usr/bin/env bats
# face Phase 03 -- L2 `arc dash`: one read door + one decision door (REQ-09).
# Each @test runs ONE self-contained node script (fixture gen -> boot -> assert -> kill,
# all inside a temp dir -- nothing writes into the repo). The wrapper asserts BOTH the
# exit code AND the script's "RAN: <n> checks" line: a suite that dies half-way, or a
# stub that reads no spine, cannot show green (the vacuous-pass rule).
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "dash doors: auth+origin matrix, cursor contract, refusals, XSS escape, one write door" {
  run node "$ARC_ROOT/tests/face/dash-doors.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
}

@test "dash parity: CLI and door emit byte-identical decision.recorded (only id/ts/sha differ)" {
  run node "$ARC_ROOT/tests/face/dash-parity.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok byte-parity: only id/ts/sha differ"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok actor named + identical"* ]] || { echo "$output"; false; }
}

@test "dash perf: p95 under 1s walking 10k events through the cursor (assumption row 1)" {
  run node "$ARC_ROOT/tests/face/dash-perf.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok walked the WHOLE spine through the cursor"* ]] || { echo "$output"; false; }
}

@test "dash spine-health: torn line and quarantine counts come from the reader, not raw dirs" {
  run node "$ARC_ROOT/tests/face/dash-health.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" == *"ok the torn line is REPORTED, not dropped"* ]] || { echo "$output"; false; }
}

@test "ask golden: 20 live-state questions answered deterministically, refusals hold" {
  run node "$ARC_ROOT/tests/face/ask-golden.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok GOLDEN BAR: 20 of 20 answered with their marker"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok every citation resolves to a ULID the state actually carries"* ]] || { echo "$output"; false; }
}

# NOTE: this file used to end with a "suite registers all N tests" test. It was FALSE as
# written -- `grep -c '^@test '` counts SOURCE LINES, so it cannot detect the very thing it
# was named for (bats silently dropping a @test whose name carries a non-ASCII character); an
# adversarial pass put a U+2014 in a test name and the count still returned N. CI's own
# _reconcile step compares declared-vs-executed TAP counts and scans for `# bats warning` on
# every leg, which catches non-execution globally and actually works. Deleted rather than
# kept as a comfort.
