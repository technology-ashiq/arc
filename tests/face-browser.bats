#!/usr/bin/env bats
# face v2 Phase 00 -- the browser steel thread (ADR-1335, ADR-1336).
#
# What runs where. The offline lockfile check and the planted-error probe need only Chrome and
# node builtins, so they run on EVERY configuration, Node 18 included. `npm ci`, the build and
# the room smoke need Vite 8's Node floor (^20.19 || >=22.12): on the Node 18 configuration they
# are a counted SKIP, and below the floor on any other configuration they FAIL, so no Node-20
# leg can pass by skipping.
#
# Chrome that cannot be found is a FAILURE naming every place looked, never a skip.
#
# Cheap checks first: the lockfile and Chrome tests leave a marker, and the install refuses to
# spend minutes of network when either cheaper check has already failed.
#
# Every `run node` that starts Chrome, a door or a preview closes fd 3 (`3>&-`): a child that
# inherits bats' fd 3 and outlives its parent keeps bats waiting, which on a runner with no job
# timeout is a six-hour hang (tests/spine-concurrency.bats has the same guard, same reason).
#
# The build runs in a COPY of face/ under $BATS_FILE_TMPDIR, so node_modules never lands in the
# repo tree that other suites walk. Tests in this file run in order and share that copy.
#
# Every program is its own file: this suite runs no inline program text, and the last-but-one
# test asserts that of this very file.
bats_require_minimum_version 1.5.0
load 'test_helper'

FLOOR_SKIP="SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19"

require_node_floor() {
  local line major
  line="$(node "$ARC_ROOT/face/scripts/node-floor.mjs")"
  case "$line" in *"floor=ok"*) return 0 ;; esac
  major="$(printf '%s\n' "$line" | sed -n 's/.* major=\([0-9][0-9]*\)$/\1/p')"
  if [ "$major" = "18" ]; then
    skip "$FLOOR_SKIP ($line)"
  fi
  echo "below the L3 floor on a configuration that must run the browser suite: $line"
  return 1
}

@test "face-browser: the node floor is reported, and only Node 18 may skip" {
  run node "$ARC_ROOT/face/scripts/node-floor.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "node=v"*" floor="*" major="* ]] || { echo "unexpected floor line: $output"; false; }
  require_node_floor
}

@test "face-browser: the lockfile carries this platform's native packages (offline)" {
  run node "$ARC_ROOT/face/scripts/lockfile-platforms.mjs"
  echo "$output"
  [[ "$output" == "lockfile: families="* ]] || { echo "the check never reported"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^lockfile: families=\([0-9][0-9]*\) .*/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 1 ] || { echo "no platform family was checked"; false; }
  [ "$status" -eq 0 ]
  touch "$BATS_FILE_TMPDIR/lockfile.ok"
}

@test "face-browser: a planted console error and exception are seen over REAL Chrome" {
  run node "$ARC_ROOT/face/scripts/smoke.mjs" --probe-file "$ARC_ROOT/tests/fixtures/face/planted-error.html" 3>&-
  echo "$output"
  [[ "$output" == *"probe: errors="* ]] || { echo "the probe never reported (exit $status)"; false; }
  [ "$status" -eq 1 ] || { echo "expected exit 1 -- errors seen -- got $status"; false; }
  [[ "$output" == *"planted-face-v2-console-error"* ]] || { echo "the console error was not seen"; false; }
  [[ "$output" == *"planted-face-v2-exception"* ]] || { echo "the exception was not seen"; false; }
  touch "$BATS_FILE_TMPDIR/chrome.ok"
}

@test "face-browser: npm ci and vite build succeed in a copy of face/" {
  require_node_floor
  [ -f "$BATS_FILE_TMPDIR/lockfile.ok" ] || { echo "the lockfile check failed above -- not spending an install on it"; false; }
  [ -f "$BATS_FILE_TMPDIR/chrome.ok" ] || { echo "the Chrome probe failed above -- not spending an install on it"; false; }
  local dst="$BATS_FILE_TMPDIR/face"
  rm -rf "$dst"
  cp -R "$ARC_ROOT/face" "$dst"
  rm -rf "$dst/node_modules" "$dst/dist"
  run npm --prefix "$dst" ci --include=optional --no-audit --no-fund 3>&-
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/node_modules/vite/package.json" ] || { echo "npm ci exited 0 but vite is not installed"; false; }
  run node "$dst/node_modules/vite/bin/vite.js" build "$dst" 3>&-
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/dist/index.html" ] || { echo "vite build exited 0 but wrote no dist/index.html"; false; }
}

@test "face-browser: door + preview + smoke open every openable room with 0 errors" {
  require_node_floor
  local dst="$BATS_FILE_TMPDIR/face"
  [ -f "$dst/dist/index.html" ] || { echo "no build from the previous test"; false; }
  run node "$ARC_ROOT/face/scripts/harness-run.mjs" --face "$dst" 3>&-
  echo "$output"
  [[ "$output" == *"face-browser: RAN leg="* ]] || { echo "the harness never started (exit $status)"; false; }
  local line opened openable errors unsettled expected
  line="$(printf '%s\n' "$output" | grep '^smoke: opened=' | tail -1)"
  [ -n "$line" ] || { echo "no smoke summary line (exit $status)"; false; }
  # Anchored extractions: each value is read from its own position in the summary line, so a
  # later `not-opened=` or `excluded-errors=` can never supply the number.
  opened="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=\([0-9][0-9]*\) .*/\1/p')"
  openable="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=\([0-9][0-9]*\) .*/\1/p')"
  errors="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=\([0-9][0-9]*\) .*/\1/p')"
  unsettled="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=[0-9]* excluded-errors=[0-9]* unsettled=\([0-9][0-9]*\) .*/\1/p')"
  expected="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=[0-9]* excluded-errors=[0-9]* unsettled=[0-9]* expected=\([0-9][0-9]*\) .*/\1/p')"
  # Asserted in this order on purpose: that something RAN, that the door served the contract's
  # rooms, that all of them opened and settled, and only then that it was clean. "errors=0" is
  # also what a smoke that opened nothing prints.
  [ -n "$openable" ] && [ "$openable" -gt 0 ] || { echo "openable=$openable: nothing was checked"; false; }
  [ "$expected" = "$openable" ] || { echo "the door served $openable openable rooms, the contract expects $expected"; false; }
  [ "$opened" = "$openable" ] || { echo "opened $opened of $openable"; false; }
  [ "$unsettled" = "0" ] || { echo "unsettled=$unsettled"; false; }
  [ "$errors" = "0" ] || { echo "errors=$errors"; false; }
  [ "$status" -eq 0 ]
}

@test "face-browser: this file runs no inline program text" {
  # The header's claim, checked rather than trusted. Split tokens keep this test from matching
  # its own source line.
  local e="-e" c="-c" hits
  hits="$(grep -nE "(node|bash|sh|python3?) +(${e}|--eval|${c}) " "$BATS_TEST_FILENAME" | grep -v 'local e=' || true)"
  [ -z "$hits" ] || { echo "inline program text found: $hits"; false; }
  local runs
  runs="$(grep -cE '^[[:space:]]+run node ' "$BATS_TEST_FILENAME")"
  [ "$runs" -ge 5 ] || { echo "only $runs run-node lines -- this check proves nothing"; false; }
}

@test "face-browser: every test in this file registered (bats drops non-ASCII names silently)" {
  # This suite is the proof of REQ-09's harness; a test that never registered is a test that
  # never failed. The declared count is the number of @test lines in this file.
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared declared"; false; }
  [ "$declared" -eq 7 ] || { echo "expected 7 @test lines, found $declared -- update this floor with the file"; false; }
}
