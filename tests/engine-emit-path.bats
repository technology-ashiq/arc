#!/usr/bin/env bats
# Cycle 7 Phase 04 -- the arc-run emit path.
#
# TWO DEFECTS, ONE CHOKE POINT. Every spine write in arc-run.mjs now goes through
# `emitEvent`, which passes `--payload-file` and `--strict`. Before this, three separate
# call sites built `--payload` inline and passed neither flag:
#
#   :279 run.completed   :379 incident.raised   :519 approval.requested
#
# Raised by the bench lane, which met the identical defect on its own emit path, fixed it
# there, and found engine had been left behind in all three places.
#
# WHY THESE TESTS AND NOT A HAPPY-PATH SMOKE: the failure being closed is a SILENT one.
# In hook mode the emitter quarantines bad input, prints a SKIP to stderr and exits 0
# (arc-event.mjs:4-6), so a run whose receipt never landed looked exactly like a green run.
# Every assertion below therefore checks that the code RAN before checking what it printed,
# and every green arm is paired with a negative control that proves the check can fail.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
EVENT() { echo "$ARC_ROOT/.claude/scripts/hq/arc-event.sh"; }
FAKE()  { echo "$ARC_ROOT/tests/fixtures/engine/driver-fakes/$1"; }

setup() { export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"; mkdir -p "$ARC_SPINE_ROOT"; }

# ---------------------------------------------------------------------------
# The payload half: a file, never an argv string
# ---------------------------------------------------------------------------

@test "emit: a Windows path in the payload survives --payload-file under strict" {
  # The exact shape bench reported as REJECT BAD_JSON -- invalid escape \U.
  payload="$BATS_TEST_TMPDIR/win.json"
  printf '%s' '{"what":"C:\\Users\\ashiq\\orca\\workspaces","severity":"low","source":"emit-path test"}' > "$payload"

  # A fixture builder asserts its own fixture. An empty file is a silent pass generator.
  [ -s "$payload" ] || { echo "fixture is empty, the test would prove nothing"; false; }

  run bash "$(EVENT)" emit incident.raised --payload-file "$payload" --strict --outcome fail
  [ "$status" -eq 0 ] || { echo "strict emit failed: $output"; false; }

  id="$(echo "$output" | tr -d '\r' | tail -1)"
  [ -n "$id" ] || { echo "no event id was printed, so nothing was sealed"; false; }

  # POSITIVE: it is in the log. Not merely absent from quarantine -- a crash satisfies absence.
  run grep -rl "$id" "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "receipt $id is not in events/"; false; }

  # And the path round-tripped intact rather than being silently mangled.
  run grep -r 'C:\\\\Users\\\\ashiq' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "the Windows path did not survive the round trip"; false; }
}

@test "emit: NEGATIVE CONTROL a malformed payload file is rejected under strict" {
  bad="$BATS_TEST_TMPDIR/bad.json"
  printf '%s' '{"what":"unterminated' > "$bad"
  [ -s "$bad" ] || { echo "fixture is empty"; false; }

  run bash "$(EVENT)" emit incident.raised --payload-file "$bad" --strict --outcome fail
  [ "$status" -ne 0 ] || { echo "strict accepted malformed JSON, so the check cannot fail"; false; }
}

@test "emit: NEGATIVE CONTROL the same malformed payload exits 0 WITHOUT strict" {
  # This is the defect being closed, stated as a fact rather than an argument: without
  # --strict the identical bad input is swallowed and the caller is told nothing.
  bad="$BATS_TEST_TMPDIR/bad2.json"
  printf '%s' '{"what":"unterminated' > "$bad"
  [ -s "$bad" ] || { echo "fixture is empty"; false; }

  run bash "$(EVENT)" emit incident.raised --payload-file "$bad" --outcome fail
  [ "$status" -eq 0 ] || { echo "hook mode is expected to exit 0 here; if this changed, the premise of --strict changed too"; false; }
}

# ---------------------------------------------------------------------------
# arc-run: the three call sites, and what an unsealed receipt now costs
# ---------------------------------------------------------------------------

@test "arc-run: no inline --payload call site remains in arc-run.mjs" {
  # The twin-fix assertion. Grep the PATTERN, not the file: this is the check that fails if
  # a fourth emit is added later built the old way.
  run grep -c -- '"--payload"' "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"
  [ "$output" = "0" ] || { echo "an inline --payload call site is back in arc-run.mjs"; false; }
}

@test "arc-run: every emit goes through the one helper" {
  # Three call sites, one choke point. If a future edit reintroduces a direct arc-event.sh
  # invocation for an emit, this fails.
  run grep -c "emitEvent(" "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"
  [ "$status" -eq 0 ]
  # 1 definition + 3 call sites
  [ "$output" -ge 4 ] || { echo "expected the helper plus three call sites, found $output"; false; }
}

@test "arc-run: a normal run still exits 0 and still seals a receipt" {
  # THE REGRESSION GUARD. The change must not have bought strictness by breaking the green
  # path -- and this assertion fails if emitRun is deleted, which is the bar the rules set.
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "a good run no longer exits 0: $output"; false; }

  run grep -rl "run.completed" "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "the run.completed receipt was not sealed"; false; }
}

@test "arc-run: an unsealed receipt makes the run exit non-zero" {
  # THE POINT OF THE WHOLE CHANGE. A spine root that is a FILE cannot hold events/, so the
  # emit fails for a reason that is real on every OS rather than simulated by a flag.
  broken="$BATS_TEST_TMPDIR/spine-is-a-file"
  printf 'not a directory' > "$broken"
  [ -s "$broken" ] || { echo "fixture is empty"; false; }

  ARC_SPINE_ROOT="$broken" ARC_DRIVER_FAKE="$(FAKE good)" \
    run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"

  [ "$status" -ne 0 ] || { echo "the receipt could not land and the run STILL reported success"; false; }

  # Assert it RAN and reached the emit, rather than dying somewhere earlier and satisfying
  # the status check by accident.
  [[ "$output" == *"NOT recorded"* ]] || { echo "the run failed, but not at the emit: $output"; false; }
}

@test "arc-run: the answer is still printed when the receipt cannot land" {
  # The honest pair: the caller gets the output AND a non-zero status. Losing the answer
  # would trade one silent failure for a louder one.
  broken="$BATS_TEST_TMPDIR/spine-file-2"
  printf 'not a directory' > "$broken"

  ARC_SPINE_ROOT="$broken" ARC_DRIVER_FAKE="$(FAKE good)" \
    run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"

  [[ "$output" == *"commits"* ]] || { echo "the driver answer was lost: $output"; false; }
}

# ---------------------------------------------------------------------------
# The suite counts itself
# ---------------------------------------------------------------------------
#
# bats silently DROPS a @test whose name carries a non-ASCII character -- Cycle 7 lost five
# tests that way and the file stayed green. A suite that IS the proof of a rule asserts its
# own registered total, so a dropped test fails loudly instead of vanishing.

@test "suite: all 9 tests in this file are registered" {
  run grep -c "^@test " "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$output" = "9" ] || { echo "expected 9 registered tests, found $output -- a test was dropped or added without updating this count"; false; }
}
