#!/usr/bin/env bats
# Phase 00 ckpt B -- REQ-04: state is derived, never truth.
#
# The whole claim is that derived/ can be deleted at any moment and rebuilt from the JSONL
# alone, byte for byte. Both halves are asserted here and both enter CI:
#   (a) rm derived && arc-replay && arc brief  ->  byte-identical
#   (b) the same brief via the canonical JSONL-scan path, with no sqlite involved
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="replay-seed"
  _seed_spine
}

_seed_spine() {
  bash "$EVENT" emit note.logged --payload '{"note":"one"}' --strict >/dev/null
  bash "$EVENT" emit commit.done --payload '{"sha":"abc123"}' --strict >/dev/null
  bash "$EVENT" emit review.completed --payload '{"findings":2}' --strict >/dev/null
}

@test "replay rebuilds the idem index whole from the spine" {
  run node "$HQ/arc-replay.mjs" --quiet
  [ "$status" -eq 0 ]
  run wc -l < "$SPINE/derived/idem.index"
  [ "$(echo "$output" | tr -d ' ')" = "3" ]
}

@test "REQ-04(a): deleting derived state and replaying reproduces the brief byte-identically" {
  node "$HQ/arc-replay.mjs" --quiet
  node "$HQ/arc-brief.mjs" --date 2026-07-22 > "$BATS_TEST_TMPDIR/before.txt"

  rm -rf "$SPINE/derived"
  [ ! -d "$SPINE/derived" ]

  node "$HQ/arc-replay.mjs" --quiet
  node "$HQ/arc-brief.mjs" --date 2026-07-22 > "$BATS_TEST_TMPDIR/after.txt"

  run diff "$BATS_TEST_TMPDIR/before.txt" "$BATS_TEST_TMPDIR/after.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "REQ-04(b): the canonical JSONL-scan path renders the same bytes with no sqlite" {
  node "$HQ/arc-replay.mjs" --quiet
  node "$HQ/arc-brief.mjs" --date 2026-07-22 --engine scan > "$BATS_TEST_TMPDIR/scan.txt"

  # A runner without node:sqlite has no state.db to fall back on. Deleting it proves the
  # scan path stands alone rather than quietly reading the accelerator.
  rm -f "$SPINE/derived/state.db"
  node "$HQ/arc-brief.mjs" --date 2026-07-22 --engine scan > "$BATS_TEST_TMPDIR/scan2.txt"

  run diff "$BATS_TEST_TMPDIR/scan.txt" "$BATS_TEST_TMPDIR/scan2.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # REQ-05 groups the brief (the ckpt-B flat "events: N" is gone): the 3 seeded events render
  # as 2 progress (commit.done, review.completed) + 1 background (note.logged).
  run grep -qF "progress (2)" "$BATS_TEST_TMPDIR/scan2.txt"; [ "$status" -eq 0 ]
  run grep -qF "background (1)" "$BATS_TEST_TMPDIR/scan2.txt"; [ "$status" -eq 0 ]
}

@test "replay repairs an idem index that lost an entry to a crash" {
  node "$HQ/arc-replay.mjs" --quiet
  # The confirmed crash window: an event appended, the process killed before its index
  # entry. Left alone, a redelivery would be accepted twice.
  head -n 2 "$SPINE/derived/idem.index" > "$BATS_TEST_TMPDIR/trunc"
  cp "$BATS_TEST_TMPDIR/trunc" "$SPINE/derived/idem.index"

  node "$HQ/arc-replay.mjs" --quiet
  run wc -l < "$SPINE/derived/idem.index"
  [ "$(echo "$output" | tr -d ' ')" = "3" ]
}

@test "replay reports an unparseable line instead of quietly skipping it" {
  printf 'this is not json\n' >> "$SPINE/events/2026-07-22.jsonl"
  run node "$HQ/arc-replay.mjs"
  [ "$status" -eq 0 ]
  [[ "$output" == *"unparseable"* ]]
  # ...and the brief says so too: a damaged day must not read as a quiet one.
  run node "$HQ/arc-brief.mjs" --date 2026-07-22
  [[ "$output" == *"UNREADABLE LINES: 1"* ]]
}
