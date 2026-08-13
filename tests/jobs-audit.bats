#!/usr/bin/env bats
# Phase 03 -- the proving week's INSTRUMENT, tested before the week has any data in it.
#
# WHY THAT ORDERING IS THE POINT. A measurement built after seeing the results can be tuned into
# one that flatters them without anyone intending it: a threshold nudged, a category widened, an
# awkward slot reclassified as expected. The phase spec names the rabbit hole outright ("grading
# the week on vibes"). Writing the instrument and its fixtures blind is the strongest available
# answer -- there is no data yet to tune against, and these assertions are what stop it being
# quietly adjusted later.
#
# It already paid for itself: the fixtures below found the audit cutting its window on
# `ts.slice(0, 10)` while slots live in IST, so a receipt rendered in UTC fell outside the window
# and its slot read as MISSED. The instrument would have reported a failure that never happened,
# on the first slot of every window, and there would have been no way to tell it from a real one.
bats_require_minimum_version 1.5.0
load 'test_helper'

H="$ARC_ROOT/tests/fixtures/jobs/audit-harness.mjs"
JOBS="$ARC_ROOT/.claude/scripts/hq/arc-jobs.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="00112233445566778899"
}

_case() {
  run node "$H" "$1"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
}

# A NEGATIVE assertion, written as an `if` on purpose. The tempting one-liner
# `echo "$out" | grep -q X && { echo; false; }` returns 1 in BOTH directions under errexit -- once
# because the block ran, once because grep found nothing -- so it fails the test precisely when
# the code is correct. Same helper, and same reasoning, as tests/jobs-register.bats.
_refute() {
  if echo "$output" | grep -q -F -- "$1"; then
    echo "unwanted in output: $1"
    echo "$output"
    false
  fi
}

@test "_refute: the helper this file relies on can actually fail" {
  output="MISSED:2026-08-08T06:00:00+05:30"
  run _refute "2026-08-08"
  [ "$status" -ne 0 ] || { echo "_refute passed on a string that IS present"; false; }
  output="MISSED:none"
  run _refute "2026-08-08"
  [ "$status" -eq 0 ] || { echo "_refute failed on a string that is absent"; false; }
}

@test "audit: a perfect week is clean, and every expected slot is accounted for" {
  # The control every negative case below depends on. If a clean week did not come back clean,
  # nothing else in this file would mean anything.
  _case perfect-week
  echo "$output" | grep -q '^EXPECTED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "the first slot of the window went missing:"; echo "$output"; false; }
  echo "$output" | grep -q '^MANUAL:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^SPEND:0$' || { echo "$output"; false; }
}

@test "audit: a slot with nothing against it is an UNEXPLAINED gap, and it is named" {
  _case one-missed
  echo "$output" | grep -q '^MISSED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q -F '2026-08-06T00:15:00+05:30' || { echo "the gap was counted but not named:"; echo "$output"; false; }
}

@test "audit: an incident naming the slot is an EXPLAINED absence, not a miss" {
  # The phase spec asks for "a run.completed or an explained absence". A wrapper that refused the
  # run and said so has not gone silent, and counting it as silence would send someone looking for
  # a dead scheduler instead of reading the incident.
  _case explained-by-incident
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '"policy-declined":1' || { echo "$output"; false; }
}

@test "audit: a skip note naming the slot is an explained absence too" {
  _case explained-by-note
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:1$' || { echo "$output"; false; }
}

@test "audit: a run that FAILED is not a missed slot" {
  # Two different repairs: "the scheduler never fired" and "the work failed". Collapsing them
  # sends every investigation to the wrong half of the system.
  _case failed-run-is-not-a-gap
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^FAILED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:6$' || { echo "$output"; false; }
}

@test "audit: a manual start is counted BY ACTOR, and does not hide in the completed count" {
  # REQ-06 is zero manual starts. The only field separating a scheduled fire from an attended one
  # is the actor, so matching on anything else would make the claim unfalsifiable -- and the run
  # still counts as completed, because it did complete. Both facts, separately.
  _case manual-start
  echo "$output" | grep -q '^MANUAL:1$' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'WHO:["session"]' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "a manual run was also counted as a miss:"; echo "$output"; false; }
}

@test "audit: a receipt rendered in UTC still lands in its IST window" {
  # THE DEFECT THESE FIXTURES FOUND, pinned. The window was cut on `ts.slice(0, 10)` while slots
  # live in IST, so a 00:15 IST receipt carries a UTC date of the PREVIOUS day and fell out of the
  # window -- and a dropped run does not read as an error, it reads as a MISSED SLOT. The
  # instrument would have reported a failure that never happened, on the first slot of every
  # window, indistinguishable from a real one.
  local f="$ARC_ROOT/.claude/scripts/hq/lib/jobs/audit.mjs"
  if grep -n 'ts\.slice(0, *10)' "$f"; then
    echo "the window is being cut on the raw timestamp prefix again, not on the parsed IST day"
    false
  fi
  grep -q "istDay(at)" "$f" || { echo "the window is no longer cut on a parsed IST day"; false; }
}

@test "audit: a weekdays job expects NOTHING on the weekend" {
  # Five slots in a Mon-Sun week, not seven. The constant-interval version of this arithmetic made
  # every healthy weekdays job overdue every Monday.
  _case weekend
  echo "$output" | grep -q '^EXPECTED:5$' || { echo "$output"; false; }
  _refute "2026-08-08"
  _refute "2026-08-09"
}

@test "audit: a disabled job expects nothing and misses nothing" {
  _case disabled
  echo "$output" | grep -q '^EXPECTED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
}

@test "audit: a run at a slot nobody scheduled is REPORTED, not dropped" {
  # A catch-up lands here legitimately -- and so would a task firing on a schedule nobody wrote.
  # Dropping the category would hide the second inside the first.
  _case unscheduled-run
  echo "$output" | grep -q -F '2026-08-05T13:00:00+05:30' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
}

@test "audit: drift p50 takes the LOWER middle, never a mean" {
  # Drift is measured against a wall clock in whole milliseconds. Averaging two middles invents a
  # value no run actually had, and every figure in this pack has to point at a real receipt.
  _case drift
  echo "$output" | grep -q '^DRIFT_P50:5000$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_EVEN:10$' || { echo "the even case averaged instead of taking the lower:"; echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_ODD:20$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_EMPTY:null$' || { echo "an empty list produced a number:"; echo "$output"; false; }
}

@test "audit: money spent by a job that must not spend is counted, not ignored" {
  # Spend-carrying kinds are unschedulable by jobs-lint on top of policy's own money law, so any
  # figure here is a finding rather than a number.
  _case spend
  echo "$output" | grep -q '^SPEND:12$' || { echo "$output"; false; }
}

@test "audit: an UNDECLARED incident class is counted separately, never folded away" {
  # A new failure mode landing silently in a pack that reads "0 incidents" is the metric telling
  # the opposite of the truth.
  _case unknown-incident-class
  echo "$output" | grep -q -F '"something-nobody-declared":1' || { echo "$output"; false; }
  echo "$output" | grep -q '"policy-declined":0' || { echo "it was folded into a declared bucket:"; echo "$output"; false; }
}

@test "audit: the same events and window derive byte-identically twice" {
  # The pack has to be re-checkable by anyone later. Date.now() is absent from the derivation
  # rather than merely discouraged, and this is what would catch it coming back.
  _case replay
  echo "$output" | grep -q '^IDENTICAL:true$' || { echo "$output"; false; }
}

@test "audit: a backwards or malformed window is REFUSED, never folded into an empty pack" {
  # An empty pack reads as a clean week. Every bad bound has to raise rather than return nothing.
  _case bad-window
  [ "$(printf '%s\n' "$output" | grep -c '^REFUSED:')" -eq 3 ] || { echo "$output"; false; }
  _refute "ACCEPTED:"
}

@test "audit: the slot string it builds is the slot string a receipt carries" {
  # THE GAP AUDIT IS A STRING MATCH. Render UTC here and every served slot reads as an unexplained
  # gap while every run reads as unscheduled -- a total inversion that still looks like a report.
  _case iso-slot-matches-receipt
  echo "$output" | grep -q '^MATCH:true$' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'BUILT:"2026-08-03T00:15:00+05:30"' || { echo "$output"; false; }
}

@test "audit: the needs-you history reconstructs the days the panel WOULD have nagged" {
  # The fire-drill's shape: a job that ran, then went silent because its OS task was removed while
  # the yaml still said enabled. There is no receipt to count -- the panel's lines are derived --
  # so the history is rebuilt by replaying the pure derivation once per day of the window.
  _case needs-you-history
  echo "$output" | grep -q -F '"2026-08-07"' || { echo "the silence never surfaced:"; echo "$output"; false; }
  echo "$output" | grep -q '"missed":3' || { echo "$output"; false; }
}

@test "audit: a healthy week writes NOTHING into the needs-you history" {
  # The negative control for the test above. A function that reported every day would satisfy it.
  _case needs-you-quiet
  echo "$output" | grep -q -F 'DAYS:[]' || { echo "a clean week produced nags:"; echo "$output"; false; }
}

@test "audit: the history refuses to run without the panel derivation injected" {
  # It reasons ABOUT the renderer; it does not import one. A silent fallback would let the audit
  # and the brief disagree about the same day while both looked correct.
  _case needs-you-needs-panel
  echo "$output" | grep -q '^REFUSED:' || { echo "$output"; false; }
}

@test "audit CLI: a window ending today is refused, because the day is not over" {
  # A day still in progress has slots that have not arrived, and the derivation cannot tell "has
  # not come" from "did not happen" -- it would count every slot later today as MISSED. That is
  # this lane's recurring failure shape pointed at its own instrument.
  local today
  today="$(node -e "process.stdout.write(new Date(Date.now()+19800000).toISOString().slice(0,10))")"
  run node "$JOBS" audit --from "$today" --to "$today"
  [ "$status" -eq 2 ] || { echo "wanted exit 2 for an unfinished day, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "has not finished" || { echo "$output"; false; }
  # And --partial is the declared way to ask for it anyway, so the guard is a default, not a wall.
  run node "$JOBS" audit --from "$today" --to "$today" --partial
  [ "$status" -eq 0 ] || [ "$status" -eq 1 ] || { echo "--partial did not run at all: $status"; echo "$output"; false; }
  echo "$output" | grep -q "metric pack" || { echo "$output"; false; }
}

@test "audit CLI: it prints the pre-declared pack and states a verdict, not just numbers" {
  # A pack that only prints figures leaves the reading of them to whoever wants a particular
  # answer, which is the failure the pre-declaration exists to stop.
  run node "$JOBS" audit --from 2026-08-03 --to 2026-08-09
  [ "$status" -eq 1 ] || { echo "an empty spine over a full week should not be clean: $status"; echo "$output"; false; }
  for line in "metric pack" "drift p50" "manual starts (target 0)" "incidents" "spend (expected 0)" "needs-you days"; do
    echo "$output" | grep -q -F "$line" || { echo "the pack is missing: $line"; echo "$output"; false; }
  done
  echo "$output" | grep -q "NOT CLEAN" || { echo "twelve missed slots did not produce a verdict:"; echo "$output"; false; }
}

@test "jobs-audit: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}
