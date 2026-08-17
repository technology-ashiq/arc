#!/usr/bin/env bats
# Phase 07, REQ-04 -- the four fields a runtime row must carry, enforced AT LOAD TIME.
#
# A runtime is hired, not installed. `cap:`, `hosted:`, `judge:` and `review_by:` are all four
# mandatory on a row that routes to an agent runtime, and a row missing any of them fails the
# router LOAD rather than the dispatch -- because a row that only fails when someone happens to
# route through it sits wrong for as long as nobody uses it.
#
# REQ-04 asks for hostile fixtures covering ABSENT, EMPTY, NULL and MALFORMED per field. That is
# SIXTEEN cases, not four: a near-miss that loads is a guard that cannot fail. `cap: ""` reads as
# decided and decides nothing; `cap: null` is a YAML VALUE rather than an omission; `cap: [x]` is
# the right word in the wrong shape.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/engine-router-row-probe.mjs"; }
RUN()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }

@test "router-row: the full 16-cell hostile matrix is covered and every cell refuses" {
  # Four fields times four malformed shapes. The matrix is enumerated in one place so a reader
  # can see that no cell is missing -- which is the property that actually matters here.
  run node "$(PROBE)" matrix
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"cells=16"* ]] || { echo "the matrix is not 16 cells: $output"; false; }
  [[ "$output" == *"MATRIX_COMPLETE"* ]] || { echo "$output"; false; }
}

@test "router-row: NEGATIVE CONTROL -- a sound row LOADS" {
  # Without this, every cell above is satisfied by a validator that refuses everything.
  run node "$(PROBE)" good
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GOOD_ROW_LOADS"* ]] || { echo "$output"; false; }
}

@test "router-row: an ordinary row carrying NONE of the four is untouched" {
  # This has to land as one reviewed diff, not as a rewrite of every row in the file.
  run node "$(PROBE)" untouched
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ordinary_faults=0"* ]] || { echo "$output"; false; }
}

@test "router-row: a PARTIAL row cannot sneak past by not being a runtime row" {
  # Someone adding `cap: L1-drafts` to an ordinary class and stopping there has written a row
  # that reads as capped and is not. Carrying ANY of the four means carrying all four.
  run node "$(PROBE)" untouched
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"partial_faults=3"* ]] || { echo "a partial row was accepted: $output"; false; }
  [[ "$output" == *"PARTIAL_CAUGHT"* ]] || { echo "$output"; false; }
}

@test "router-row: tenure expires strictly AFTER review_by, checked at the boundary" {
  # The boundary is the only interesting day, and it is only testable because the clock is a
  # parameter rather than new Date() inside the function.
  run node "$(PROBE)" tenure
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TENURE_BOUNDARY_CORRECT"* ]] || { echo "$output"; false; }
}

@test "router-row: a date that parses but does not exist is refused" {
  # 2026-02-31 passes a YYYY-MM-DD shape check and then compares as a real instant -- a tenure
  # nobody set, arrived at by arithmetic.
  run node "$(PROBE)" impossible-date
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"IMPOSSIBLE_DATE_REFUSED"* ]] || { echo "$output"; false; }
}

@test "router-row: the REAL engine/router.yaml loads clean" {
  # Without this the validator could be correct and the file it guards still broken.
  run node "$(PROBE)" real-router
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REAL_ROUTER_CLEAN"* ]] || { echo "$output"; false; }
}

@test "router-row: arc-run refuses to LOAD a router with a faulty row, not to dispatch" {
  # The layer is the point. Proven by pointing arc-run at a root whose router carries a partial
  # row: it must die at load, before it can report anything about routing.
  local root="$BATS_TEST_TMPDIR/fakeroot"
  mkdir -p "$root/engine" "$root/processes"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$root/processes/"
  cat > "$root/engine/router.yaml" <<'YAML'
version: 1
tiers:
  - balanced-workhorse
classes:
  commit-msg-draft:
    tier: balanced-workhorse
    driver: hermes
    cap: L1-drafts
YAML
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto --dry-run
  [ "$status" -ne 0 ] || { echo "a faulty router loaded: $output"; false; }
  [[ "$output" == *"will not load"* ]] || { echo "wrong failure: $output"; false; }
  [[ "$output" == *"hosted"* ]] || { echo "the missing field is not named: $output"; false; }
  [[ "$output" != *"would run"* ]] || { echo "it reached routing before failing: $output"; false; }
}

# ---------------------------------------------------------------------------------------------
# TENURE, DRIVEN THROUGH arc-run. Everything above proves the FUNCTION; these prove the MECHANISM.
#
# Until 2026-08-17 nothing here drove arc-run through an expired row at all -- `isExpired` was
# exported, unit-tested at its boundary, and called by nothing that dispatches. The mutant
# `expiredRow = null` left all nine tests green. That gap is also why the FIRST wiring shipped with
# an idem key the spine refuses, so five refusals left zero proposals and nobody noticed: the
# idempotency claim was satisfied vacuously, because 0 is at most 1.
# ---------------------------------------------------------------------------------------------

expired_root() {
  local root="$1" by="${2:-2020-01-01}"
  mkdir -p "$root/engine" "$root/processes"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$root/processes/"
  cat > "$root/engine/router.yaml" <<YAML
version: 1
tiers:
  - balanced-workhorse
classes:
  commit-msg-draft:
    tier: balanced-workhorse
    driver: mock
    cap: L1-drafts
    hosted: local
    judge: ashiq
    review_by: $by
    fallback: []
YAML
}

@test "tenure: arc-run REFUSES to dispatch through an expired row, naming the row and the file" {
  local root="$BATS_TEST_TMPDIR/expired"
  expired_root "$root"
  export ARC_SPINE_ROOT="$root/spine"
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto
  [ "$status" -ne 0 ] || { echo "an expired row dispatched: $output"; false; }
  [[ "$output" == *"EXPIRED on 2020-01-01"* ]] || { echo "the refusal does not name the date: $output"; false; }
  [[ "$output" == *"engine/router.yaml"* ]] || { echo "the refusal does not name the file to edit: $output"; false; }
}

@test "tenure: five dispatches through one expired row leave EXACTLY ONE proposal" {
  # The idempotency claim, measured rather than asserted. A queue that grows by one per attempt is
  # a queue a human stops reading, which turns the loudest refusal in the system into noise.
  local root="$BATS_TEST_TMPDIR/idem"
  expired_root "$root"
  mkdir -p "$root/spine"
  # EXPORTED, not prefixed onto the `run` call. `VAR=x run node …` sets VAR for the bats `run`
  # FUNCTION, and a bash assignment before a function is not exported to the function's children --
  # so `node` never saw it, wrote to the real spine root, and the count here was 0. It works when
  # you type it in a shell because an assignment before an EXTERNAL command IS exported for that
  # command. Two different rules, one syntax; CI caught it and this box could not have.
  export ARC_SPINE_ROOT="$root/spine"
  for _ in 1 2 3 4 5; do
    run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto
    [ "$status" -ne 0 ]
  done
  local proposals
  proposals="$(grep -ho 'approval.requested' "$root"/spine/events/*.jsonl 2>/dev/null | wc -l | tr -d ' ')"
  [ "$proposals" = "1" ] || { echo "expected exactly 1 proposal after 5 refusals, found $proposals"; false; }
  # AND it must have LANDED rather than quarantined. The first version of this mechanism passed a
  # non-sha256 idem, so every proposal was REJECTED and the count above was 0 -- vacuously "at most
  # one". An absence assertion alone cannot tell one from none.
  local quarantined
  quarantined="$(find "$root/spine/_quarantine" -type f 2>/dev/null | wc -l | tr -d ' ')"
  [ "$quarantined" = "0" ] || { echo "$quarantined record(s) were quarantined -- the proposal is not landing"; false; }
}

@test "tenure: the refusal leaves a run receipt too, so it is not invisible" {
  # The data-boundary refusal in the same file already does this, under its own rule: a boundary
  # that stops a run and leaves no trace is indistinguishable from a run nobody attempted. Two
  # adjacent refusal paths, and only one of them recorded.
  local root="$BATS_TEST_TMPDIR/receipt"
  expired_root "$root"
  export ARC_SPINE_ROOT="$root/spine"
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto
  [ "$status" -ne 0 ]
  run grep -ho '"reason":"tenure"' "$root"/spine/events/*.jsonl
  [ "$status" -eq 0 ] || { echo "no run receipt names the tenure refusal"; false; }
}

@test "tenure: a row still INSIDE its tenure dispatches normally" {
  # The negative control. Without it, "refuses an expired row" is satisfied by refusing every row.
  local root="$BATS_TEST_TMPDIR/live"
  expired_root "$root" "2099-01-01"
  export ARC_SPINE_ROOT="$root/spine"
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto --dry-run
  [ "$status" -eq 0 ] || { echo "a live row was refused: $output"; false; }
  [[ "$output" == *"would run"* ]] || { echo "$output"; false; }
  [[ "$output" != *"EXPIRED"* ]]
}

@test "tenure: --dry-run reports the refusal instead of promising a run" {
  # It printed "would run" and exited 0 for a dispatch that refuses. A preview that is wrong in the
  # reassuring direction is worse than no preview.
  local root="$BATS_TEST_TMPDIR/dry"
  expired_root "$root"
  export ARC_SPINE_ROOT="$root/spine"
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto --dry-run
  [ "$status" -ne 0 ] || { echo "dry-run promised a run that would refuse: $output"; false; }
  [[ "$output" == *"would REFUSE"* ]] || { echo "$output"; false; }
  [[ "$output" != *"would run"* ]]
}

@test "tenure: an EXPLICIT --driver is validated and refused too, not just --driver auto" {
  # `loadRouter()` ran only inside the `--driver auto` branch, so the same file reported four faults
  # under `auto` and exited 0 under `--driver hermes`. arc-bench makes `--driver` MANDATORY -- so
  # the one lane that spends real money was the lane that validated nothing.
  local root="$BATS_TEST_TMPDIR/explicit"
  expired_root "$root"
  export ARC_SPINE_ROOT="$root/spine"
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver mock --dry-run
  [ "$status" -ne 0 ] || { echo "an explicit --driver bypassed tenure: $output"; false; }
  [[ "$output" == *"EXPIRED"* ]] || { echo "$output"; false; }
}

@test "router-row: a fallback INTO the agent runtime carries the four terms too" {
  # `isRuntime` looked at `row.driver` alone, so a row with `driver: claude-code` and
  # `fallback: [hermes]` loaded with ZERO faults -- no cap, no tenure -- and on the first driver
  # fault arc-run dispatches to the runtime through it. router.yaml's own comment says exactly this
  # must not happen; it guarded the wrong direction.
  local root="$BATS_TEST_TMPDIR/fallback"
  mkdir -p "$root/engine" "$root/processes"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$root/processes/"
  cat > "$root/engine/router.yaml" <<'YAML'
version: 1
tiers:
  - balanced-workhorse
classes:
  commit-msg-draft:
    tier: balanced-workhorse
    driver: claude-code
    fallback:
      - hermes
YAML
  run node "$(RUN)" --root "$root" --process commit-msg-draft --driver auto --dry-run
  [ "$status" -ne 0 ] || { echo "a row that can reach the runtime loaded unbounded: $output"; false; }
  [[ "$output" == *"will not load"* ]]
  [[ "$output" == *"fallback chain"* ]] || { echo "the reason does not name the fallback: $output"; false; }
}

@test "this file registers every test it declares" {
  # FIXED 2026-08-17. It counted `^@test ` lines in the SOURCE -- the DECLARED count. bats silently
  # DROPS a @test whose name carries a non-ASCII character and the source line survives the drop,
  # so the number never moved while a test did not run. Seven sibling engine suites already carried
  # the fixed form; this one, written the same week in the same directory, carried the defeated one.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "16" ] || { echo "expected 16 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}
