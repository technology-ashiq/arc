#!/usr/bin/env bats
# face Phase 03 -- L2 `arc dash`: one read door + one decision door (REQ-09).
# Each @test runs ONE self-contained node script (fixture gen -> boot -> assert -> kill,
# all inside a temp dir -- nothing writes into the repo). The wrapper asserts BOTH the
# exit code AND the script's "RAN: <n> checks" line: a suite that dies half-way, or a
# stub that reads no spine, cannot show green (the vacuous-pass rule).
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "dash doors: auth+origin matrix, cursor contract, refusals, XSS escape, one write door" {
  run node "$ARC_ROOT/tests/face/dash-doors.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
}

@test "dash parity: CLI and door emit byte-identical decision.recorded (only id/ts/sha differ)" {
  run node "$ARC_ROOT/tests/face/dash-parity.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok byte-parity: only id/ts/sha differ"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok actor named + identical"* ]] || { echo "$output"; false; }
}

@test "dash perf: p95 under 1s walking 10k events through the cursor (assumption row 1)" {
  run node "$ARC_ROOT/tests/face/dash-perf.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok walked the WHOLE spine through the cursor"* ]] || { echo "$output"; false; }
}

@test "dash spine-health: torn line and quarantine counts come from the reader, not raw dirs" {
  run node "$ARC_ROOT/tests/face/dash-health.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" == *"ok the torn line is REPORTED, not dropped"* ]] || { echo "$output"; false; }
}

@test "work door: every op plans without writing, applies once, and writes the hand-run's own receipt" {
  run node "$ARC_ROOT/tests/face/work-door.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok counting fixture: two concurrent applies invoked the tool EXACTLY ONCE"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok bench.run-model: NO SECOND PATH -- the door's receipt is the hand-run's receipt"* ]] || { echo "$output"; false; }
}

@test "session door: every session starts arc-run --driver from a click, and attach survives a door restart" {
  run node "$ARC_ROOT/tests/face/session-door.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  # A failed check prints a line STARTING "FAIL ". Matched at the line start, never as a bare *FAIL* glob: an ok line
  # naming a mutant once read every green run as red (attack 60c13e9 B1).
  ! grep -q '^FAIL ' <<< "$output" || { echo "$output"; false; }
  [[ "$output" == *"ok every other row reached a spawn (the loop judged real starts, not refusals)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by driver-only: the harness claude as the command"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok a FRESH door attaches to the run door A started, while it runs"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok its receipt is read back OFF THE SPINE THE DOOR NAMED, credited because"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok a real event the run named as ANOTHER kind, and printed bare, is unattributed"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok dispatch naming ship's process is held back BY NAME"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok the run never saw the door's token, the owner's deploy/VCS tokens or the leads steering list"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok a start with no click is 428 CLICK_REQUIRED"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok review-ship.ship: REFUSED until its deploy stop is enforced"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok a checkout on main: BRANCH_REFUSED, nothing started"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok a key the run printed is served redacted, never as written"* ]] || { echo "$output"; false; }
}

@test "live rooms: the pulse holds still, moves with the spine, stays out of the journal; a pulse re-reads every read" {
  run node "$ARC_ROOT/tests/face/live-pulse.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok the pulse MOVES when the spine does"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok readsToLoad: a PULSE re-reads every read, polled or not (REQ-11)"* ]] || { echo "$output"; false; }
}

@test "proposal branch: plumbing only -- the plan writes nothing, the write adds one ref, the owner's tree untouched" {
  run node "$ARC_ROOT/tests/face/proposal-branch.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok the write left HEAD, the index, the working tree and main as they were"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok refused: hq.policy.yaml, even when the caller allows it -> UNGRANTABLE"* ]] || { echo "$output"; false; }
}

@test "kernel ring: the owning-lane tools -- jobs flags, engine proposals, policy promotion, evolve to a verdict, SIM_EFFECT" {
  run node "$ARC_ROOT/tests/face/kernel-ring.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok evolve conclude, applied: the verdict lands on the spine"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok door: a sim door refuses the effect's apply -> SIM_EFFECT, and the tool never ran"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok rule-propose: THE HOMES are byte-identical in the tree after every proposal and refusal"* ]] || { echo "$output"; false; }
}

@test "factory ring: develop next, open-brief, pick, profile, retire and add-agent APPLIED in scratch repos; touchesTree is SIM_EFFECT" {
  run node "$ARC_ROOT/tests/face/factory-ring.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok agent-scaffold, applied: the golden holds its line -- sha256 of the bytes, CR stripped -- in byte order"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok door: a sim door refuses a touchesTree apply -> SIM_EFFECT, and the tool never ran"* ]] || { echo "$output"; false; }
}

@test "money ring: ingest, the kill review and the venture register APPLIED in scratch; the door accepts their plans" {
  run node "$ARC_ROOT/tests/face/money-work.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok ingest, applied: one revenue.received per payment"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok register, applied: the branch holds the new venture"* ]] || { echo "$output"; false; }
}

@test "live lanes: the daily send bound to its plan, and the legal full-read gate raised into the inbox" {
  run node "$ARC_ROOT/tests/face/live-work.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok leads daily, planned: the approved draft and the sha the owner approved"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok legal propose, applied: the payload written"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok legal propose refuses the same bytes a second time"* ]] || { echo "$output"; false; }
}

@test "company ring: a lane's status and a term's definition APPLIED in scratch, each on a proposal branch with its request" {
  run node "$ARC_ROOT/tests/face/company-work.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok lane-status, applied: the branch holds the new board row"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok on the branch, the CI gate reads the new status"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT CONTROL: board-lint names the face lane"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok concept-define, applied: the branch homes the term"* ]] || { echo "$output"; false; }
}

@test "ask golden: 20 live-state questions answered deterministically, refusals hold" {
  run node "$ARC_ROOT/tests/face/ask-golden.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok GOLDEN BAR: 20 of 20 answered with their marker"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok every citation resolves to a ULID the state actually carries"* ]] || { echo "$output"; false; }
}

# NOTE: this file used to end with a "suite registers all N tests" test. It was FALSE as
# written -- `grep -c '^@test '` counts SOURCE LINES, so it cannot detect the very thing it
# was named for (bats silently dropping a @test whose name carries a non-ASCII character); an
# adversarial pass put a U+2014 in a test name and the count still returned N. CI's own
# _reconcile step compares declared-vs-executed TAP counts and scans for `# bats warning` on
# every leg, which catches non-execution globally and actually works. Deleted rather than
# kept as a comfort.
