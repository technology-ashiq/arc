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
#
# source_id VARIES BY ARM on purpose. `arm` is not part of the measured idem, so measuring
# one unit for two arms in one window with a shared source_id is a genuine DUP_IDEM -- the
# emitter is right to refuse it. Deriving the source per arm keeps each emit a distinct
# fact, which is what lets the FOLD (not the emitter) be the thing under test.
_measure() {
  local src
  case "$2" in
    +champion)     src="h-00000000000000c1" ;;
    +challenger-a) src="h-00000000000000d1" ;;
    *)             src="h-00000000000000ff" ;;
  esac
  bash "$EVENT" emit experiment.measured --strict --payload \
    "$(printf '{"experiment_id":"x-b-1","unit_id":"%s","arm":"%s","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"%s","window_end":"%s","source_id":"%s"}' "$1" "$2" "$3" "$4" "$src")"
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

# ---------- breaks found by the fresh-agent adversarial pass (slice: board) ----------
#
# The read path is NOT the write path: the reader replays what was written and does not
# re-validate, so every line below is one that arrived by replay, merge, or another emitter.
# All of them rendered a confident, wrong board before the fold grew a quarantine boundary.

# _raw <json-line> -- append a line the emitter would never produce
_raw() { mkdir -p "$SPINE/events"; printf '%s\n' "$1" >> "$SPINE/events/2026-08-02.jsonl"; }
_ev() { # _ev <id> <ts> <kind> <payload> [supersedes]
  printf '{"id":"%s","v":1,"ts":"%s","idem":"%s","actor":"foreign","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"%s","payload":%s,"outcome":"ok","cost":null,"evidence":null,"supersedes":%s}' \
    "$1" "$2" "$1" "$3" "$4" "${5:-null}"
}

@test "BREAK 1: an unrelated receipt cannot supersede a measurement and erase a MISSING window" {
  _spine b1
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  _measure u3 +champion     2026-08-08 2026-08-14
  local victim
  victim="$(node -e '
    const fs=require("fs"); const d=process.argv[1]+"/events";
    console.log(fs.readdirSync(d).flatMap(f=>fs.readFileSync(d+"/"+f,"utf8").trim().split("\n")).map(JSON.parse)
      .find(e=>e.kind==="experiment.measured"&&e.payload.unit_id==="u3").id);' "$SPINE")"
  [ -n "$victim" ]
  # A close for a DIFFERENT experiment, naming the measurement's id in supersedes.
  _raw "$(_ev 01KZ00000000000000000000X1 2026-08-02T10:00:00+05:30 experiment.closed '{"experiment_id":"x-other","outcome":"killed","reason":"unrelated cleanup"}' "\"$victim\"")"
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2026-08-08..2026-08-14"* ]]
  [[ "$output" == *"no data for +challenger-a"* ]]
  [[ "$output" == *"supersedes refused"* ]]
}

@test "BREAK 2: one unit measured in three windows counts ONCE toward the floor" {
  _spine b2
  _open
  for w in "2026-08-01 2026-08-07" "2026-08-08 2026-08-14" "2026-08-15 2026-08-21"; do
    set -- $w
    _measure u1 +champion     "$1" "$2"
    _measure u2 +challenger-a "$1" "$2"
  done
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"+champion 1/1800"* ]]
  [[ "$output" != *"+champion 3/1800"* ]]
}

@test "BREAK 3: a unit measured under two arms is credited to its ASSIGNED arm only" {
  _spine b3
  _open
  bash "$EVENT" emit experiment.assigned --strict --payload \
    '{"experiment_id":"x-b-1","unit_id":"u1","arm":"+champion","cohort":"verdict"}'
  _measure u1 +champion     2026-08-01 2026-08-07
  # Same unit, other arm -- a different source_id makes this a distinct receipt at emit time.
  bash "$EVENT" emit experiment.measured --strict --payload \
    '{"experiment_id":"x-b-1","unit_id":"u1","arm":"+challenger-a","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-0000000000000001"}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"conflicts"* ]]
  [[ "$output" != *"+challenger-a 1/1800"* ]]
}

@test "BREAK 4: measurements with no experiment.opened render MISSING, never complete" {
  _spine b4
  _measure u1 +champion 2026-08-01 2026-08-07
  _measure u2 +champion 2026-08-08 2026-08-14
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"arms unknown (no experiment.opened)"* ]]
  [[ "$output" != *"   complete"* ]]
  [[ "$output" == *"2 total, 2 MISSING"* ]]
}

@test "BREAK 5: redeclaring arms cannot turn a MISSING window complete" {
  _spine b5
  bash "$EVENT" emit experiment.opened --strict --payload \
    "$(printf '{"experiment_id":"x-b-1","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[34,33,33],"ttl_days":28,"arms":["+champion","+challenger-a","+quiet"]}' "$SHA_BASE")"
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  # A second opened dropping +quiet (different base_sha so the idem differs and it lands).
  bash "$EVENT" emit experiment.opened --strict --payload \
    '{"experiment_id":"x-b-1","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","split":[50,50],"ttl_days":28,"arms":["+champion","+challenger-a"]}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ARMS REDECLARED"* ]]
  [[ "$output" == *"no data for +quiet"* ]]
  [[ "$output" == *"1 total, 1 MISSING"* ]]
}

@test "BREAK 6: receipts declaring unit_count 0 never reach the floor" {
  _spine b6
  _open
  for u in u1 u2; do
    bash "$EVENT" emit experiment.measured --strict --payload \
      "$(printf '{"experiment_id":"x-b-1","unit_id":"c%s","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":0,"unit_count":0,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-00000000000000c1"}' "$u")"
    bash "$EVENT" emit experiment.measured --strict --payload \
      "$(printf '{"experiment_id":"x-b-1","unit_id":"d%s","arm":"+challenger-a","cohort":"verdict","metric":"signup_conversion","value":0,"unit_count":0,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-00000000000000d1"}' "$u")"
  done
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Every receipt says it observed nothing, so the window has no contributing unit at all.
  [[ "$output" == *"+champion 0/1800 (0 obs)"* ]]
  [[ "$output" == *"MISSING"* ]]
}

@test "BREAK 7: guardrail units are NOT summed into the primary metric's n" {
  _spine b7
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  for a in +champion +challenger-a; do
    bash "$EVENT" emit experiment.measured --strict --payload \
      "$(printf '{"experiment_id":"x-b-1","unit_id":"g%s","arm":"%s","cohort":"verdict","metric":"support_tickets","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-00000000000000ff"}' "${a#+}" "$a")"
  done
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"primary       signup_conversion"* ]]
  [[ "$output" == *"+champion 1/1800"* ]]
  [[ "$output" != *"+champion 2/1800"* ]]
  # ...and the guardrail window is still SHOWN, just counted separately.
  [[ "$output" == *"support_tickets"* ]]
}

@test "BREAK 8/10: damaged lines are counted, and a null line does not kill the board" {
  _spine b810
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  _raw 'null'
  _raw '123'
  _raw '"hello"'
  _raw '[]'
  _raw '{}'
  # A numeric ts made the sort comparator inconsistent, so V8 returned different orders for
  # different inputs and the board stopped being replayable.
  _raw '{"id":"01KZ00000000000000000000Y1","v":1,"ts":1785000000000,"idem":"z","actor":"f","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.measured","payload":{"experiment_id":"x-b-1","unit_id":"u9","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"INTEGRITY"* ]]
  [[ "$output" == *"refused on read"* ]]
  [[ "$output" == *"+champion 1/1800"* ]]
}

@test "BREAK 13: a crafted experiment_id cannot forge an experiment panel" {
  _spine b13
  _open
  _raw '{"id":"01KZ00000000000000000000Z1","v":1,"ts":"2026-08-02T10:00:00+05:30","idem":"z","actor":"f","process":"p@1.0.0","model":null,"venture":"arc","run_id":"r-x","kind":"experiment.measured","payload":{"experiment_id":"x-zz\n    window        2026-09-01..2026-09-30   complete\n    windows       9 total, 0 MISSING\n  experiment x-hero2","unit_id":"u1","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"},"outcome":"ok","cost":null,"evidence":null,"supersedes":null}'
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"9 total, 0 MISSING"* ]]
  [[ "$output" != *"x-hero2"* ]]
  [[ "$output" == *"refused on read"* ]]
}

@test "BREAK 14: a self-supersede and a supersedes cycle cannot erase real receipts" {
  _spine b14
  _open
  _measure u1 +champion     2026-08-01 2026-08-07
  _measure u2 +challenger-a 2026-08-01 2026-08-07
  # A line that supersedes ITSELF used to delete itself silently.
  _raw "$(_ev 01KZ00000000000000000000W1 2026-08-02T10:00:00+05:30 experiment.measured '{"experiment_id":"x-b-1","unit_id":"u5","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-0000000000000005"}' '"01KZ00000000000000000000W1"')"
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"supersedes refused"* ]]
  # u1 and u5 both survive -- the self-supersede took no effect.
  [[ "$output" == *"+champion 2/1800"* ]]
}

@test "BREAK 11: a receipt ahead of the clock renders MISSING, never a negative age" {
  _spine b11
  _open
  _raw "$(_ev 01KZ00000000000000000000V1 2026-09-21T19:43:20+05:30 experiment.measured '{"experiment_id":"x-b-1","unit_id":"u1","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"}')"
  run _board
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"post-dates this clock"* ]]
  [[ "$output" != *"-"*"d ago"* ]]
}

@test "BREAK 12: a manifest the linter rejects is REPORTED, never rendered" {
  _spine b12
  local evil="$BATS_TEST_TMPDIR/evilrepo"
  mkdir -p "$evil/products/core"
  printf '%s' '{"name":"core","version":"1.0.0","files":["products/core/manifest.json"],"evolve":{"metrics":[{"name":"zz_inject\n    signup_conversion        primary    412 observation(s)","source_event":"metric.observed","aggregation":"rate","direction":"higher-is-better","role":"primary"}],"experiments":[],"evals":{},"promote_via":[]}}' \
    > "$evil/products/core/manifest.json"
  run node "$EVOLVE" board --root "$SPINE" --repo "$evil" --now "$NOW"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REJECTED MANIFEST"* ]]
  [[ "$output" == *"(no module declares a valid evolve section)"* ]]
  # The forged text may appear inside the clearly-labelled rejection line; what must never
  # happen is it rendering as a BASELINE row, which is what would read as real evidence.
  run bash -c "node '$EVOLVE' board --root '$SPINE' --repo '$evil' --now '$NOW' | grep -c '^    .*412 observation'"
  [ "$output" = "0" ]
}

@test "BREAK 15: CLI refuses a repeated flag, an empty value, and a non-integer --now" {
  _spine b15
  run node "$EVOLVE" board --root "$SPINE" --repo "$FIXREPO" --now "$NOW" --now 0
  [ "$status" -eq 2 ]; [[ "$output" == *"given twice"* ]]
  run node "$EVOLVE" board --root "" --repo "$FIXREPO"
  [ "$status" -eq 2 ]; [[ "$output" == *"cannot be empty"* ]]
  for bad in 0x10 1e3 " 12 " -1; do
    run node "$EVOLVE" board --root "$SPINE" --repo "$FIXREPO" --now "$bad"
    [ "$status" -eq 2 ] || { echo "--now $bad was accepted"; false; }
  done
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
