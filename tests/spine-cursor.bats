#!/usr/bin/env bats
# Phase 03 — REQ-09: the spine orders by APPEND position, never by ULID string comparison.
#
# Two emitter processes in the same millisecond produce ULIDs with no defined order between
# them (ADR-0030 / canonical.mjs). A `--since` cursor that sorted by string would silently skip
# or repeat an event. This suite pins that with a committed same-ms burst whose append order
# (n:1,2,3,4) deliberately DISAGREES with the lexical order of its ULIDs (n:1,4,2,3): a
# string-compare reader would return a different set/order and fail here.
#
# HARDENING pin: --since is already positional today (spine.mjs applyFilters -> findIndex+slice).
# These cases lock that behaviour and a --since catch-up walk that loses/repeats nothing (DoD-3).
# A mutation of spine.mjs:113-115 to `id > since` (string compare) turns test 1 from 2 events to
# 1 -> RED; restoring -> GREEN (recorded in the phase-03 evidence bundle).
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
BURST="$ARC_ROOT/tests/fixtures/spine/same-ms-burst/2026-07-22.jsonl"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
  cp "$BURST" "$SPINE/events/2026-07-22.jsonl"
}

# ids in APPEND (file) order.
_ids() { grep -o '"id":"[0-9A-Z]\{26\}"' "$SPINE/events/2026-07-22.jsonl" | sed 's/"id":"//;s/"//'; }

@test "REQ-09: --since resolves a same-ms burst by append order, not ULID string comparison" {
  local ids; ids=($(_ids))
  [ "${#ids[@]}" -eq 4 ] || { echo "fixture must have 4 events, got ${#ids[@]}"; false; }

  # since = the SECOND-appended id. Append order -> the 3rd and 4th events, in that order. A
  # string-compare reader (id > since) would return only the one lexically-greater id.
  run node "$HQ/spine.mjs" read --since "${ids[1]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n; n="$(printf '%s\n' "$output" | grep -c '"kind":"note.logged"')"
  [ "$n" -eq 2 ] || { echo "expected 2 after a mid-append cursor (string-compare gives 1), got $n:"; echo "$output"; false; }
  printf '%s\n' "$output" | sed -n '1p' | grep -q "${ids[2]}" || { echo "1st returned is not the 3rd-appended: $output"; false; }
  printf '%s\n' "$output" | sed -n '2p' | grep -q "${ids[3]}" || { echo "2nd returned is not the 4th-appended: $output"; false; }
}

@test "REQ-09: a --since catch-up walk over the burst loses nothing and repeats nothing" {
  local ids; ids=($(_ids))

  # from the first id: exactly the remaining three, in append order
  run node "$HQ/spine.mjs" read --since "${ids[0]}"
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | grep -c '"kind":"note.logged"')" -eq 3 ]

  # from the last id: caught up -> an empty result, NOT an error
  run node "$HQ/spine.mjs" read --since "${ids[3]}"
  [ "$status" -eq 0 ]
  [ -z "$output" ] || { echo "expected empty after the last cursor, got: $output"; false; }
}
