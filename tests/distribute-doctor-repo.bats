#!/usr/bin/env bats
# distribute Phase 01 -- REQ-09's witness: `arc-doctor --repo` reads main's protection back (ADR-2015).
#
# Fixtures stand in for the GitHub API (no network in a test). An unreadable answer is UNKNOWN and
# exits 2, never "ok"; an unprotected branch is a READABLE answer and prints five MISSING lines.

bats_require_minimum_version 1.5.0
load 'test_helper'

DR() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-doctor.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/distribute/fixtures/$1"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
ran() { printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN doctor-repo' || { echo "doctor never reached its end: $output"; return 1; }; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

@test "distribute-doctor-repo: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-doctor-repo: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 4 ] || { echo "declared $declared, expected 4"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-doctor-repo: an unprotected main prints five MISSING settings and never ok" {
  run --separate-stderr node "$(DR)" --repo --protection-json "$(native "$(FX protection-404.json)")" --checkruns-json "$(native "$(FX checkruns-full.json)")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(count '^repo: [a-z-]+ +MISSING')" -eq 5 ] || { echo "$output"; false; }
  [ "$(count '^repo: [a-z-]+ +ok')" -eq 0 ] || { echo "an unprotected branch reported ok: $output"; false; }
}

@test "distribute-doctor-repo: the full ADR-2015 settings print five ok and exit 0" {
  run --separate-stderr node "$(DR)" --repo --protection-json "$(native "$(FX protection-full.json)")" --checkruns-json "$(native "$(FX checkruns-full.json)")"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(count '^repo: [a-z-]+ +ok')" -eq 5 ] || { echo "$output"; false; }
  [ "$(count '^STALE-CONTEXT')" -eq 0 ] || { echo "$output"; false; }
}

@test "distribute-doctor-repo: a stale required context and an unreadable answer are each named" {
  run --separate-stderr node "$(DR)" --repo --protection-json "$(native "$(FX protection-full.json)")" --checkruns-json "$(native "$(FX checkruns-stale.json)")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -qx 'STALE-CONTEXT: selftest (windows-latest, 20, shard 12/12)' || { echo "$output"; false; }
  run --separate-stderr node "$(DR)" --repo --protection-json "$(native "$(FX protection-partial.json)")" --checkruns-json "$(native "$(FX checkruns-full.json)")"
  ran || false
  [ "$status" -eq 1 ] && [ "$(count '^repo: (enforce-admins|no-force-push) +MISSING')" -eq 2 ] || { echo "partial: $output"; false; }
  printf 'not json' > "$BATS_TEST_TMPDIR/bad.json"
  run --separate-stderr node "$(DR)" --repo --protection-json "$(native "$BATS_TEST_TMPDIR/bad.json")" --checkruns-json "$(native "$(FX checkruns-full.json)")"
  ran || false
  [ "$status" -eq 2 ] || { echo "an unreadable answer exited $status: $output"; false; }
  [ "$(count '^repo: [a-z-]+ +UNKNOWN')" -eq 5 ] && [ "$(count ' ok$')" -eq 0 ] || { echo "$output"; false; }
}
