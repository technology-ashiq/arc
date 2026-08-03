#!/usr/bin/env bats
# evolve Phase 01 -- the board (REQ-02).
#
# Every fixture here is emitted through the REAL emitter into a throwaway spine, so a receipt
# that the validators would refuse can never quietly become board input.
#
# The load-bearing test is "an incomplete window is not counted": a reducer that sums an absent
# window to zero produces a challenger that wins on data nobody collected, and it passes every
# other test in this file.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
EVOLVE="$ARC_ROOT/.claude/scripts/evolve/arc-evolve.mjs"
FIXREPO="$ARC_ROOT/tests/fixtures/products/good-evolve"
SHA_BASE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
# Frozen clock so staleness is a pure function of the fixtures, not of when CI happens to run.
NOW="1786000000000"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

_spine() { SPINE="$BATS_TEST_TMPDIR/spine-$1"; mkdir -p "$SPINE"; export ARC_SPINE_ROOT="$SPINE"; }

_open() {
  bash "$EVENT" emit experiment.opened --strict --payload \
    "$(printf '{"experiment_id":"x-b-1","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[50,50],"ttl_days":28,"arms":["+champion","+challenger-a"]}' "$SHA_BASE")"
}

# _measure <unit> <arm> <window_start> <window_end>
_measure() {
  bash "$EVENT" emit experiment.measured --strict --payload \
    "$(printf '{"experiment_id":"x-b-1","unit_id":"%s","arm":"%s","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"%s","window_end":"%s","source_id":"h-fedcba9876543210"}' "$1" "$2" "$3" "$4")"
}

_board() { node "$EVOLVE" board --root "$SPINE" --repo "$FIXREPO" --now "$NOW"; }

# ---------- an empty spine is honest, not zero ----------

@test "board on a spine with no evolve receipts renders empty-but-honest, no crash" {
  _spine empty
  bash "$EVENT" emit note.logged --strict --payload '{"note":"unrelated"}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"(no experiments opened)"* ]]
  # No invented numbers: nothing claims a count on a spine that carries none.
  [[ "$output" != *" 0/"* ]]
}

@test "baseline panel renders MISSING, naming metric.observed as the client's kind" {
  _spine baseline
  bash "$EVENT" emit note.logged --strict --payload '{"note":"x"}'
  run _board
  [ "$status" -eq 0 ]
  [[ "$output" == *"BASELINE"* ]]
  [[ "$output" == *"signup_conversion"* ]]
  [[ "$output" == *"MISSING"* ]]
  [[ "$output" == *"ADR-0308"* ]]
  # It must be a MISSING ROW, not an omitted one -- a vanished row reads as "nothing to report".
  [[ "$output" == *"support_tickets"* ]]
}

# ---------- PENDING with real progress ----------

@test "an experiment below floor renders PENDING with n-per-arm progress" {
  _spine pending
  _open
  _measure u1 +champion 2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PENDING"* ]]
  [[ "$output" == *"+champion 1/1800"* ]]
  [[ "$output" == *"+challenger-a 1/1800"* ]]
  [[ "$output" == *"insufficient evidence"* ]]
}

# ---------- THE load-bearing case ----------

@test "an incomplete window renders MISSING and is counted for NEITHER arm" {
  _spine missingwindow
  _open
  # window 1: both arms measured -> complete, counts
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  # window 2: ONLY the champion reported -> the window is MISSING and contributes to nobody
  _measure u3 +champion     2026-08-08 2026-08-14
  _measure u4 +champion     2026-08-08 2026-08-14
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2026-08-08..2026-08-14"* ]]
  [[ "$output" == *"MISSING"* ]]
  [[ "$output" == *"no data for +challenger-a"* ]]
  # The champion measured THREE units but only ONE sits in a complete window. A reducer that
  # summed the absent arm as zero would print 3 here and hand the champion a lead built out of
  # a collection gap.
  [[ "$output" == *"+champion 1/1800"* ]]
  [[ "$output" != *"+champion 3/1800"* ]]
  [[ "$output" == *"2 total, 1 MISSING"* ]]
}

@test "a window with no measurements at all renders MISSING, never 0" {
  _spine nowindows
  _open
  run _board
  [ "$status" -eq 0 ]
  [[ "$output" == *"MISSING  no measurements"* ]]
  [[ "$output" == *"never measured"* ]]
}

# ---------- staleness carries an age ----------

@test "staleness renders with an age in days, not as a bare flag" {
  _spine stale
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  run _board
  [ "$status" -eq 0 ]
  [[ "$output" =~ last\ metric[[:space:]]+[0-9]+d\ ago ]]
}

# ---------- replay determinism (REQ-02) ----------

@test "the board is byte-identical across two renders of the same spine" {
  _spine deterministic
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  _board > "$BATS_TEST_TMPDIR/a.txt"
  _board > "$BATS_TEST_TMPDIR/b.txt"
  run diff "$BATS_TEST_TMPDIR/a.txt" "$BATS_TEST_TMPDIR/b.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "two same-ts receipts from different actors render the SAME board in either file order" {
  # The reducer must sort on a total order key (ts, id), never on the order lines happen to sit
  # in the day file. Two emitters in one millisecond produce an append order that is an accident
  # of scheduling; a board that depended on it would differ between a live and a replayed spine.
  local day="events/2026-08-02.jsonl"

  _spine order-a
  mkdir -p "$SPINE/events"
  printf '%s\n%s\n' \
    '{"id":"01KZ000000000000000000000A","v":1,"ts":"2026-08-02T10:00:00+05:30","idem":"a1","actor":"emitter-one","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.assigned","payload":{"experiment_id":"x-b-1","unit_id":"u1","arm":"+champion","cohort":"verdict"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}' \
    '{"id":"01KZ000000000000000000000B","v":1,"ts":"2026-08-02T10:00:00+05:30","idem":"b1","actor":"emitter-two","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.assigned","payload":{"experiment_id":"x-b-1","unit_id":"u2","arm":"+challenger-a","cohort":"verdict"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}' \
    > "$SPINE/$day"
  _board > "$BATS_TEST_TMPDIR/order-a.txt"

  _spine order-b
  mkdir -p "$SPINE/events"
  # SAME two events, REVERSED on disk.
  printf '%s\n%s\n' \
    '{"id":"01KZ000000000000000000000B","v":1,"ts":"2026-08-02T10:00:00+05:30","idem":"b1","actor":"emitter-two","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.assigned","payload":{"experiment_id":"x-b-1","unit_id":"u2","arm":"+challenger-a","cohort":"verdict"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}' \
    '{"id":"01KZ000000000000000000000A","v":1,"ts":"2026-08-02T10:00:00+05:30","idem":"a1","actor":"emitter-one","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.assigned","payload":{"experiment_id":"x-b-1","unit_id":"u1","arm":"+champion","cohort":"verdict"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}' \
    > "$SPINE/$day"
  _board > "$BATS_TEST_TMPDIR/order-b.txt"

  run diff "$BATS_TEST_TMPDIR/order-a.txt" "$BATS_TEST_TMPDIR/order-b.txt"
  [ "$status" -eq 0 ] || { echo "APPEND ORDER CHANGED THE BOARD:"; echo "$output"; false; }
}

@test "a correction supersedes rather than double-counting" {
  _spine supersede
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  local first
  first="$(node -e '
    const fs=require("fs");
    const dir=process.argv[1]+"/events";
    const line=fs.readdirSync(dir).filter(f=>f.endsWith(".jsonl")).flatMap(f=>fs.readFileSync(dir+"/"+f,"utf8").trim().split("\n"))
      .map(JSON.parse).find(e=>e.kind==="experiment.measured"&&e.payload.unit_id==="u1");
    console.log(line.id);' "$SPINE")"
  [ -n "$first" ]
  bash "$EVENT" emit experiment.measured --strict --supersedes "$first" --payload \
    '{"experiment_id":"x-b-1","unit_id":"u1","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":0,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # One unit, corrected -- not two units.
  [[ "$output" == *"+champion 1/1800"* ]]
}

# ---------- reader-only ----------

@test "the board reaches the spine ONLY through the reader" {
  cd "$ARC_ROOT"
  run bash .claude/scripts/review/spine-reader-lint.sh
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # ...and the lint actually covers this directory, or it proves nothing about the board.
  run grep -c "scripts/evolve" .claude/scripts/review/spine-reader-lint.sh
  [ "$status" -eq 0 ]
}
