#!/usr/bin/env bats
# distribute Phase 08 -- debt row 24 (ADR-2027): the redactor's connection-string-password rule quarantined a
# ship.done whose url was a bare-host https URL, because the payload's end ran on into `"process":"arc-event@1.0.0"`.
# The replay runs each payload through arc-event's own scanner; deploy URLs are clean, and both credential controls
# (an intact DSN, and one split at its colon across two fields) are still caught.

bats_require_minimum_version 1.5.0
load 'test_helper'

@test "distribute-redact-replay: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-redact-replay: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 2 ] || { echo "declared $declared, expected 2"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-redact-replay: deploy and PR URLs are clean and both credential controls still hit" {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/redact-replay.mjs"
  [ "$status" -eq 0 ] && printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN redact-replay' || { echo "replay never finished: $output $stderr"; false; }
  local got; got=$(printf '%s\n' "$output" | tr -d '\r' | grep -v '^RAN ')
  local want
  want=$(printf '%s\n' 'landed clean' 'bare-https clean' 'team-https clean' 'pr-url clean' 'control hit connection-string-password' 'control-split hit connection-string-password' 'control-quote hit connection-string-password')
  [ "$got" = "$want" ] || { printf 'got:\n%s\nwant:\n%s\n' "$got" "$want"; false; }
}
