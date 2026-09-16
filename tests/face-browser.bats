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
# The build runs in a COPY of face/ under $BATS_FILE_TMPDIR, so node_modules never lands in the
# repo tree that other suites walk. Tests in this file run in order and share that copy.
#
# Every program is its own file: this suite runs no inline `node -e` or `bash -c` text
# (CLAUDE.md shell-string rule).
bats_require_minimum_version 1.5.0
load 'test_helper'

FLOOR_SKIP="SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19"

require_node_floor() {
  local line major
  line="$(node "$ARC_ROOT/face/scripts/node-floor.mjs")"
  case "$line" in *"floor=ok"*) return 0 ;; esac
  major="$(printf '%s\n' "$line" | sed -n 's/.*major=\([0-9][0-9]*\).*/\1/p')"
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
  n="$(printf '%s\n' "$output" | sed -n 's/^lockfile: families=\([0-9][0-9]*\).*/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 1 ] || { echo "no platform family was checked"; false; }
  [ "$status" -eq 0 ]
}

@test "face-browser: a planted console error and exception are seen over REAL Chrome" {
  run node "$ARC_ROOT/face/scripts/smoke.mjs" --probe-file "$ARC_ROOT/tests/fixtures/face/planted-error.html"
  echo "$output"
  [[ "$output" == *"probe: errors="* ]] || { echo "the probe never reported (exit $status)"; false; }
  [ "$status" -eq 1 ] || { echo "expected exit 1 -- errors seen -- got $status"; false; }
  [[ "$output" == *"planted-face-v2-console-error"* ]] || { echo "the console error was not seen"; false; }
  [[ "$output" == *"planted-face-v2-exception"* ]] || { echo "the exception was not seen"; false; }
}

@test "face-browser: npm ci and vite build succeed in a copy of face/" {
  require_node_floor
  local dst="$BATS_FILE_TMPDIR/face"
  rm -rf "$dst"
  cp -R "$ARC_ROOT/face" "$dst"
  rm -rf "$dst/node_modules" "$dst/dist"
  run npm --prefix "$dst" ci --include=optional --no-audit --no-fund
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/node_modules/vite/package.json" ] || { echo "npm ci exited 0 but vite is not installed"; false; }
  run node "$dst/node_modules/vite/bin/vite.js" build "$dst"
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/dist/index.html" ] || { echo "vite build exited 0 but wrote no dist/index.html"; false; }
}

@test "face-browser: door + preview + smoke open every openable room with 0 errors" {
  require_node_floor
  local dst="$BATS_FILE_TMPDIR/face"
  [ -f "$dst/dist/index.html" ] || { echo "no build from the previous test"; false; }
  run node "$ARC_ROOT/face/scripts/harness-run.mjs" --face "$dst"
  echo "$output"
  [[ "$output" == *"face-browser: RAN leg="* ]] || { echo "the harness never started (exit $status)"; false; }
  local line opened openable errors
  line="$(printf '%s\n' "$output" | grep '^smoke: opened=' | tail -1)"
  [ -n "$line" ] || { echo "no smoke summary line (exit $status)"; false; }
  opened="$(printf '%s\n' "$line" | sed -n 's/.*opened=\([0-9][0-9]*\).*/\1/p')"
  openable="$(printf '%s\n' "$line" | sed -n 's/.*openable=\([0-9][0-9]*\).*/\1/p')"
  errors="$(printf '%s\n' "$line" | sed -n 's/.* errors=\([0-9][0-9]*\).*/\1/p')"
  # Asserted in this order on purpose: that something RAN, then that all of it opened, then
  # that it was clean. "errors=0" is also what a smoke that opened nothing prints.
  [ -n "$openable" ] && [ "$openable" -gt 0 ] || { echo "openable=$openable: nothing was checked"; false; }
  [ "$opened" = "$openable" ] || { echo "opened $opened of $openable"; false; }
  [ "$errors" = "0" ] || { echo "errors=$errors"; false; }
  [ "$status" -eq 0 ]
}

@test "face-browser: every test in this file registered (bats drops non-ASCII names silently)" {
  # This suite is the proof of REQ-09's harness; a test that never registered is a test that
  # never failed. The declared count is the number of @test lines in this file.
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared declared"; false; }
  [ "$declared" -eq 6 ] || { echo "expected 6 @test lines, found $declared -- update this floor with the file"; false; }
}
