#!/usr/bin/env bats
# ci Phase 00 -- the scripts the one-Linux gate runs (ADR-2201, ADR-2202). Floor and changes arms run
# against fixture trees and file lists, never the real tree's count, which every new test moves.
# Every case asserts its command RAN (non-empty output) before it believes what was printed.

bats_require_minimum_version 1.5.0
load 'test_helper'

FLOOR() { node "$ARC_ROOT/.claude/scripts/core/ci-floor.mjs" "$@"; }
CHANGES() { node "$ARC_ROOT/.claude/scripts/core/ci-changes.mjs" "$@"; }

# A tree holding one bats file with three declared tests (one indented, as _declared counts it).
mk_tree() {
  T="$BATS_TEST_TMPDIR/tree"; mkdir -p "$T/tests"
  printf '@test "a" {\n  true\n}\n  @test "b" {\n  true\n}\n@test "c" {\n  true\n}\n' > "$T/tests/x.bats"
}

@test "ci-floor: a count below the floor fails and names both numbers" {
  mk_tree
  run FLOOR --root "$T" --baseline 4
  [ -n "$output" ]
  [ "$status" -eq 1 ]
  [[ "$output" == *"test count 3 < floor 4"* ]]
}

@test "ci-floor: a count at the floor passes" {
  mk_tree
  run FLOOR --root "$T" --baseline 3
  [ -n "$output" ]
  [ "$status" -eq 0 ]
}

@test "ci-floor: a count above the floor passes and says what to raise" {
  mk_tree
  run FLOOR --root "$T" --baseline 2
  [ "$status" -eq 0 ]
  [[ "$output" == *"raise BASELINE to 3"* ]]
}

@test "ci-floor: a DROPPED row lowers the floor by one, a reasonless row is refused" {
  mk_tree
  printf '| old | new | why |\n|---|---|---|\n| gone test | DROPPED | tests a deleted script |\n' > "$T/tests/DROPPED.md"
  run FLOOR --root "$T" --baseline 4
  [ -n "$output" ]
  [ "$status" -eq 0 ]
  printf '| gone test | DROPPED |  |\n' > "$T/tests/DROPPED.md"
  run FLOOR --root "$T" --baseline 4
  [ "$status" -eq 2 ]
}

@test "ci-floor: a lane .count adds to the declared total; a malformed one is refused" {
  mk_tree
  mkdir -p "$T/tests/org"
  printf '2\n' > "$T/tests/org/.count"
  run FLOOR --root "$T" --baseline 5
  [ -n "$output" ]
  [ "$status" -eq 0 ]
  printf 'two\n' > "$T/tests/org/.count"
  run FLOOR --root "$T" --baseline 5
  [ "$status" -eq 2 ]
  [[ "$output" == *"bad .count"* ]]
}

@test "ci-changes: a face path sets face, a docs path sets neither" {
  L="$BATS_TEST_TMPDIR/files"
  printf 'face/src/a.tsx\n' > "$L"
  run CHANGES --files "$L"
  [ -n "$output" ]
  [[ "$output" == *"face=true"* ]]
  [[ "$output" == *"citier=false"* ]]
  printf 'docs/a.md\n' > "$L"
  run CHANGES --files "$L"
  [ -n "$output" ]
  [[ "$output" == *"face=false"* ]]
  [[ "$output" == *"citier=false"* ]]
}

@test "ci-changes: the docker image and the trivy adapter set citier" {
  L="$BATS_TEST_TMPDIR/files"
  printf '.claude/scripts/review/arc-scan/adapters/trivy.sh\n' > "$L"
  run CHANGES --files "$L"
  [[ "$output" == *"citier=true"* ]]
  printf 'docker/arc-tools/Dockerfile\n' > "$L"
  run CHANGES --files "$L"
  [[ "$output" == *"citier=true"* ]]
}

@test "ci-changes: an empty list or a missing base fails OPEN" {
  L="$BATS_TEST_TMPDIR/files"
  : > "$L"
  run CHANGES --files "$L"
  [ -n "$output" ]
  [[ "$output" == *"face=true"* ]]
  [[ "$output" == *"citier=true"* ]]
  run CHANGES --base "" --head HEAD
  [ -n "$output" ]
  [[ "$output" == *"face=true"* ]]
  [[ "$output" == *"citier=true"* ]]
}

@test "ci-bats-shard: a shard that resolves to no files refuses" {
  run bash "$ARC_ROOT/.claude/scripts/core/ci-bats-shard.sh" 99999 100000
  [ -n "$output" ]
  [ "$status" -ne 0 ]
  [[ "$output" == *"no files"* ]]
}
