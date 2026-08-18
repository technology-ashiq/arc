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
  # spineHealth is part of spine.mjs (the ONE public API, ADR-1301) -- assert it exists as
  # an export and reports the fixture's planted torn line through a plain import.
  run node --input-type=module -e "
    import { spineHealth } from '$(echo "$ARC_ROOT" | sed 's/\\\\/\//g')/.claude/scripts/hq/spine.mjs';
    import { execFileSync } from 'node:child_process';
    import { mkdtempSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';
    const dir = join(mkdtempSync(join(tmpdir(), 'face-health-')), 'spine');
    const gen = JSON.parse(execFileSync(process.execPath, ['$(echo "$ARC_ROOT" | sed 's/\\\\/\//g')/tests/fixtures/face/gen-spine.mjs', '--out', dir, '--count', '300', '--days', '3', '--seed', 'health-1'], {stdio:['ignore','pipe','inherit']}).toString());
    if (gen.events !== 300) { console.log('FIXTURE NOT LOADED'); process.exit(1); }
    const h = spineHealth(dir);
    if (h.events !== 300) { console.log('health saw', h.events); process.exit(1); }
    if (h.torn.length !== 1) { console.log('torn not reported:', JSON.stringify(h.torn)); process.exit(1); }
    if (h.daysClosed !== 2) { console.log('seals wrong:', h.daysClosed); process.exit(1); }
    console.log('RAN: spineHealth over 300-event fixture, torn=1, sealed=2');
  "
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: spineHealth"* ]] || { echo "$output"; false; }
}
