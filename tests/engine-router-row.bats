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

# A fake root carrying ONLY a router and a process. Enough to prove the refusal, and deliberately
# not enough to emit: `arc-run` resolves `.claude/scripts/hq/arc-event.sh` from `--root`, so a root
# without that tree cannot write a receipt. The refusal is non-fatal about a failed emit by design,
# so these tests still assert exactly what they name.
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

# The same root PLUS the machinery a receipt needs. `arc-run` builds the emitter path from `--root`,
# so a receipt-asserting test has to carry `.claude/scripts` with it -- CI proved that by failing
# with "Command failed: bash <root>/.claude/scripts/hq/arc-event.sh" while the idem was perfectly
# correct. Kept separate from `expired_root` because the copy is I/O-heavy and load-sensitive (this
# repo already records a flake of exactly that shape), so only the two tests that assert receipts
# pay for it.
expired_root_emitting() {
  local root="$1" by="${2:-2020-01-01}"
  expired_root "$root" "$by"
  mkdir -p "$root/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$root/.claude/scripts"
  [ -f "$root/.claude/scripts/hq/arc-event.sh" ] || { echo "the emitter was not copied into the fake root"; false; }
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
  expired_root_emitting "$root"
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
  expired_root_emitting "$root"
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

# ---------------------------------------------------------------------------------------------
# ADR-0225 -- termination is a fixture, not a comment
# ---------------------------------------------------------------------------------------------

# A root whose router carries NO class rows at all: the state after the termination spec's step 2.
terminated_root() {
  local root="$1"
  mkdir -p "$root/engine" "$root/processes"
  cp "$ARC_ROOT/processes/build-in-public-draft.process.yaml" "$root/processes/"
  cat > "$root/engine/router.yaml" <<YAML
version: 1
tiers:
  - balanced-workhorse
classes: {}
default:
  tier: balanced-workhorse
  driver: claude-code
  fallback: []
YAML
}

@test "ADR-0225 TERMINATION: with the row deleted the runtime is unreachable, even named explicitly" {
  # THE TERMINATION SPEC WAS FALSE TWICE, and this fixture exists because prose could not catch it.
  # engine/router.yaml said deleting the row is "the only form with no reachable remainder: no row,
  # no route". Measured 2026-08-23: arc-run printed `would run build-in-public-draft on hermes` and
  # exited 0. The wording it REPLACED had been found false the same way on 2026-08-17 -- a false
  # claim about a governance mechanism, corrected by another false claim about the same mechanism,
  # inside the same comment. A termination step is a claim about behaviour and belongs here.
  local root="$BATS_TEST_TMPDIR/terminated"
  terminated_root "$root"
  run node "$(RUN)" --root "$root" --process build-in-public-draft --driver hermes --dry-run
  [ "$status" -eq 2 ] || { echo "a deleted row did not terminate the hire, got $status: $output"; false; }
  [[ "$output" == *"does not grant the agent runtime"* ]] || { echo "the refusal does not name the cause: $output"; false; }
  # Exit 5 is the DATA BOUNDARY and means the document may not go there; this is an operator error.
  # A fixture has to be able to tell the two apart, so the code is asserted and not merely non-zero.
  [[ "$output" != *"internal-only"* ]] || { echo "a grant refusal was reported as a data-boundary refusal: $output"; false; }
}

@test "ADR-0225: a class whose row names ANOTHER driver does not vouch for the runtime" {
  # "Any row exists for this class" would have been satisfied by commit-msg-draft, whose row names
  # claude-code -- and that is precisely the near-miss guard shape this cycle keeps finding. The
  # grant has to name the thing being granted. This is also the path arc-bench takes: it makes
  # --driver MANDATORY, so the one lane that spends real money was the ungoverned one.
  run node "$(RUN)" --root "$ARC_ROOT" --process commit-msg-draft --driver hermes --dry-run
  [ "$status" -eq 2 ] || { echo "an ungranted class dispatched the runtime, got $status: $output"; false; }
  [[ "$output" == *"does not grant the agent runtime"* ]] || { echo "$output"; false; }
  # The refusal names what the row DOES grant, so the operator is not left guessing.
  [[ "$output" == *"claude-code"* ]] || { echo "the refusal does not name the row's own chain: $output"; false; }
}

@test "ADR-0225 NEGATIVE CONTROL: the granted class still dispatches, and in-house drivers are untouched" {
  # Without this, a rule that refuses EVERY runtime dispatch passes both tests above -- and the
  # cycle would have shipped a termination that works by breaking the hire.
  run node "$(RUN)" --root "$ARC_ROOT" --process build-in-public-draft --driver hermes --dry-run
  [ "$status" -eq 0 ] || { echo "the granted class was refused: $output"; false; }
  [[ "$output" == *"would run"* ]] || { echo "$output"; false; }
  # And an in-house driver on an ungranted class is not a hire and is not touched by the rule.
  run node "$(RUN)" --root "$ARC_ROOT" --process commit-msg-draft --driver mock --dry-run
  [ "$status" -eq 0 ] || { echo "an in-house driver was caught by the runtime-grant rule: $output"; false; }
}

@test "this file registers every test it declares" {
  # FIXED 2026-08-17. It counted `^@test ` lines in the SOURCE -- the DECLARED count. bats silently
  # DROPS a @test whose name carries a non-ASCII character and the source line survives the drop,
  # so the number never moved while a test did not run. Seven sibling engine suites already carried
  # the fixed form; this one, written the same week in the same directory, carried the defeated one.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "19" ] || { echo "expected 19 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}
