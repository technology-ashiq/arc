#!/usr/bin/env bats
# Phase 02 — REQ-05: the day reads in ONE screen. `arc brief` groups the spine's events into
# needs-you / money / progress / background, formats money from minor units, and collapses the
# noisy groups (background first, then progress) to counts when the day overflows the line
# budget; --full expands. Reader-only (SPINE-G). Deterministic: fixed group order, events in
# append order, counts sorted by kind.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
BRIEF="$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"          # 2026-07-22
  export ARC_SPINE_RAND="00112233445566778899"
}
_emit()  { bash "$EVENT" emit "$@" --strict >/dev/null; }
_brief() { node "$BRIEF" --date 2026-07-22 "$@"; }

@test "brief: groups events into needs-you / money / progress / background, money from minor units" {
  _emit approval.requested --payload '{"what":"deploy prod"}'
  _emit revenue.received   --payload '{"amount":50000,"currency":"INR"}' --venture venturemind
  _emit phase.closed       --payload '{"phase":"01"}'
  _emit review.completed   --payload '{"verdict":"ship"}'
  _emit qa.completed       --payload '{"bugs":0}'
  _emit commit.done        --payload '{"sha":"abc"}'
  _emit ship.done          --payload '{"target":"branch"}'
  _emit note.logged        --payload '{"n":1}'
  _emit note.logged        --payload '{"n":2}'
  _emit redaction.applied  --payload '{"count":1}'

  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local want; want=$(cat <<'EOF'
brief 2026-07-22

needs-you (1)
  approval.requested

money (1)
  revenue.received  INR 500.00  venturemind

progress (5)
  phase.closed
  review.completed
  qa.completed
  commit.done
  ship.done

background (3)
  note.logged
  note.logged
  redaction.applied
EOF
)
  [ "$output" = "$want" ] || { echo "=== diff (want < / got >) ==="; diff <(printf '%s\n' "$want") <(printf '%s\n' "$output"); false; }
}

@test "brief: an overflowing day collapses the noisy groups to counts; --full expands" {
  export ARC_BRIEF_MAX_LINES=8            # test-only budget door; production stays 40
  _emit phase.closed      --payload '{"p":1}'
  _emit note.logged       --payload '{"n":1}'
  _emit note.logged       --payload '{"n":2}'
  _emit note.logged       --payload '{"n":3}'
  _emit redaction.applied --payload '{"r":1}'

  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"background: 4 (note.logged 3 · redaction.applied 1)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"--full to expand"* ]]
  [[ "$output" == *"progress (1)"* ]]      # needs-you/money/progress never collapse first
  [[ "$output" != *"note.logged"$'\n'* ]]  # background items are collapsed, not listed

  run _brief --full
  [ "$status" -eq 0 ]
  [[ "$output" == *"background (4)"* ]]     # expanded
  [[ "$output" != *"--full to expand"* ]]
}
